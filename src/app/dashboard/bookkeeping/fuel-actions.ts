"use server";

import { bookkeepingCtx, ISO_DATE, NOT_ALLOWED, OK, refreshBookkeeping, type ActionResult } from "@/lib/bookkeeping/server-actions";
import { allowedVatMethods, CO2_BANDS, FUEL_TYPES, isVatMethod, reclaimPctFor, VEHICLE_TYPES } from "@/lib/bookkeeping/fuel";
import { roundMoney } from "@/lib/format";

export type VehicleInput = {
  name: string;
  registration: string;
  vehicleType: string;
  fuelType: string;
  privateUse: boolean;
  vatMethod: string;
  businessSharePct: number | null;
  co2Band: string;
};

function cleanVehicle(input: VehicleInput) {
  const name = String(input.name ?? "").trim().slice(0, 80);
  if (!name) return { error: "Give the vehicle a name (e.g. 'Market van')." } as const;
  if (!(VEHICLE_TYPES as readonly string[]).includes(input.vehicleType)) return { error: "Pick what kind of vehicle it is." } as const;
  if (!(FUEL_TYPES as readonly string[]).includes(input.fuelType)) return { error: "Pick the fuel type." } as const;
  const privateUse = !!input.privateUse;
  const allowed = allowedVatMethods(input.vehicleType, privateUse);
  const vatMethod = isVatMethod(input.vatMethod) && allowed.includes(input.vatMethod) ? input.vatMethod : allowed[0];
  const pct = Number(input.businessSharePct);
  if (vatMethod === "business_share" && !(Number.isFinite(pct) && pct >= 0 && pct <= 100)) return { error: "Enter the business share as a % between 0 and 100." } as const;
  if (vatMethod === "scale_charge" && !CO2_BANDS.includes(input.co2Band)) return { error: "Pick the car's CO2 band (it's on the V5C logbook)." } as const;
  return {
    row: {
      name,
      registration: String(input.registration ?? "").trim().toUpperCase().slice(0, 12) || null,
      vehicle_type: input.vehicleType,
      fuel_type: input.fuelType,
      private_use: privateUse,
      vat_method: vatMethod,
      business_share_pct: vatMethod === "business_share" ? pct : null,
      co2_band: vatMethod === "scale_charge" ? input.co2Band : null,
    },
  } as const;
}

export async function saveVehicle(id: string | null, input: VehicleInput): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  const cleaned = cleanVehicle(input);
  if ("error" in cleaned) return { error: cleaned.error ?? "Invalid vehicle." };
  const { error } = id
    ? await c.supabase.from("vehicles").update(cleaned.row).eq("id", id).eq("org_id", c.org.orgId)
    : await c.supabase.from("vehicles").insert({ ...cleaned.row, org_id: c.org.orgId });
  if (error) return { error: error.message };
  refreshBookkeeping();
  return OK;
}

/** A vehicle with receipts is kept (so old receipts still say which vehicle) but hidden; one with
 * none is removed. */
export async function removeVehicle(id: string): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  const { count } = await c.supabase.from("fuel_receipts").select("id", { count: "exact", head: true }).eq("vehicle_id", id);
  const { error } = count
    ? await c.supabase.from("vehicles").update({ active: false }).eq("id", id).eq("org_id", c.org.orgId)
    : await c.supabase.from("vehicles").delete().eq("id", id).eq("org_id", c.org.orgId);
  if (error) return { error: error.message };
  refreshBookkeeping();
  return OK;
}

export type FuelReceiptInput = {
  vehicleId: string | null;
  date: string;
  station: string;
  stationVatNumber: string;
  fuelType: string;
  litres: number | null;
  pricePerLitre: number | null;
  total: number;
  vatOnReceipt: number;
  paymentMethod: string;
  receiptPath: string | null;
  notes: string;
};

/** Saves a fuel receipt and the matching "Fuel" expense. The expense's VAT is only the part that
 * may be reclaimed; the rest of the VAT is part of the cost. With no VAT number on the receipt,
 * nothing is reclaimed — HMRC needs a valid VAT receipt. */
export async function saveFuelReceipt(input: FuelReceiptInput): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  const { org, supabase } = c;

  const station = String(input.station ?? "").trim().slice(0, 120);
  const total = roundMoney(Number(input.total));
  const vatOnReceipt = roundMoney(Number(input.vatOnReceipt));
  if (!station) return { error: "Enter the filling station." };
  if (!ISO_DATE.test(input.date)) return { error: "Enter the receipt date." };
  if (!Number.isFinite(total) || total <= 0) return { error: "Enter the amount paid." };
  if (!Number.isFinite(vatOnReceipt) || vatOnReceipt < 0 || vatOnReceipt > total / 6 + 0.02) return { error: "The VAT can't be more than 1/6 of the total (20%)." };

  let vehicle: { id: string; vat_method: string; business_share_pct: number | null } | null = null;
  if (input.vehicleId) {
    const { data } = await supabase.from("vehicles").select("id, vat_method, business_share_pct").eq("id", input.vehicleId).eq("org_id", org.orgId).maybeSingle();
    if (!data) return { error: "That vehicle couldn't be found." };
    vehicle = data;
  }
  const vatNumber = String(input.stationVatNumber ?? "").trim().toUpperCase().slice(0, 20);
  const reclaimPct = vatNumber ? reclaimPctFor(vehicle) : 0;
  const vatReclaimed = roundMoney((vatOnReceipt * reclaimPct) / 100);
  const method = input.paymentMethod === "cash" ? "cash" : input.paymentMethod === "bank" ? "bank" : "card";
  const receiptPath = input.receiptPath && input.receiptPath.startsWith(`${org.orgId}/`) ? input.receiptPath : null;
  const litres = Number(input.litres);

  const { data: receipt, error } = await supabase
    .from("fuel_receipts")
    .insert({
      org_id: org.orgId,
      vehicle_id: vehicle?.id ?? null,
      receipt_date: input.date,
      station,
      station_vat_number: vatNumber || null,
      fuel_type: String(input.fuelType ?? "").slice(0, 20) || null,
      litres: Number.isFinite(litres) && litres > 0 ? litres : null,
      price_per_litre: Number(input.pricePerLitre) > 0 ? Number(input.pricePerLitre) : null,
      total,
      vat_on_receipt: vatOnReceipt,
      reclaim_pct: reclaimPct,
      vat_reclaimed: vatReclaimed,
      payment_method: method,
      receipt_path: receiptPath,
      notes: String(input.notes ?? "").trim().slice(0, 500) || null,
    })
    .select("id")
    .single();
  if (error || !receipt) return { error: error?.message ?? "Couldn't save the fuel receipt." };

  const { error: expenseError } = await supabase.from("expenses").insert({
    org_id: org.orgId,
    expense_date: input.date,
    payee: station,
    category: "Fuel",
    description: [input.fuelType, Number.isFinite(litres) && litres > 0 ? `${litres} L` : null].filter(Boolean).join(" · ") || null,
    net_amount: roundMoney(total - vatReclaimed),
    vat_amount: vatReclaimed,
    payment_method: method,
    receipt_url: receiptPath,
    fuel_receipt_id: receipt.id,
  });
  if (expenseError) {
    await supabase.from("fuel_receipts").delete().eq("id", receipt.id);
    return { error: expenseError.message };
  }

  refreshBookkeeping();
  return OK;
}

/** Removes a fuel receipt, its expense (cascade) and its photo. */
export async function deleteFuelReceipt(id: string): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  const { data: receipt } = await c.supabase.from("fuel_receipts").select("id, receipt_path").eq("id", id).eq("org_id", c.org.orgId).maybeSingle();
  if (!receipt) return { error: "Fuel receipt not found." };
  const { error } = await c.supabase.from("fuel_receipts").delete().eq("id", receipt.id);
  if (error) return { error: error.message };
  if (receipt.receipt_path) await c.supabase.storage.from("receipts").remove([receipt.receipt_path]);
  refreshBookkeeping();
  return OK;
}
