"use server";

import { VAT_RATES } from "@/lib/bookkeeping/categories";
import { bookkeepingCtx, ISO_DATE, NOT_ALLOWED, OK, refreshBookkeeping, type ActionResult } from "@/lib/bookkeeping/server-actions";
import { roundMoney } from "@/lib/format";

export type CreditNoteLineInput = { description: string; qty: number; unitPrice: number; net: number; vatRate: number; vat: number };

export type CreditNoteInput = {
  vendorId: string | null;
  supplierName: string;
  supplierVatNumber: string;
  creditNoteNumber: string;
  creditDate: string;
  originalInvoiceRef: string;
  accountReference: string;
  reason: string;
  notes: string;
  imagePath: string | null;
  lines: CreditNoteLineInput[];
};

const CREDIT_NOTE_STATUSES = ["open", "applied", "refunded"];

const text = (v: string, max: number) => String(v ?? "").trim().slice(0, max) || null;

/** Saves a supplier credit note with every line. Totals are worked out from the lines so the
 * header can never disagree with them. */
export async function createCreditNote(input: CreditNoteInput): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  const { org, supabase } = c;

  const supplierName = text(input.supplierName, 120);
  if (!supplierName) return { error: "Enter the supplier who sent the credit note." };
  if (!ISO_DATE.test(input.creditDate)) return { error: "Enter the credit note date." };
  if (!Array.isArray(input.lines) || !input.lines.length || input.lines.length > 60) return { error: "Add between 1 and 60 lines." };

  const lines: CreditNoteLineInput[] = [];
  for (const l of input.lines) {
    const description = String(l.description ?? "").trim().slice(0, 200);
    const qty = Number(l.qty);
    const net = roundMoney(Math.abs(Number(l.net)));
    const vat = roundMoney(Math.abs(Number(l.vat)));
    const vatRate = Number(l.vatRate);
    if (!description) return { error: "Every line needs a description." };
    if (!Number.isFinite(qty) || qty <= 0) return { error: `"${description}" needs a quantity above zero.` };
    if (!Number.isFinite(net) || !Number.isFinite(vat)) return { error: `"${description}" has an invalid amount.` };
    if (!(VAT_RATES as readonly number[]).includes(vatRate)) return { error: `"${description}" has an invalid VAT rate.` };
    if (Math.abs(vat - (net * vatRate) / 100) > 0.1) return { error: `The VAT on "${description}" doesn't match its rate.` };
    lines.push({ description, qty, unitPrice: roundMoney(Math.abs(Number(l.unitPrice) || net / qty)), net, vatRate, vat });
  }

  let vendorId: string | null = null;
  if (input.vendorId) {
    const { data: vendor } = await supabase.from("vendors").select("id").eq("id", input.vendorId).eq("org_id", org.orgId).maybeSingle();
    if (!vendor) return { error: "That supplier couldn't be found." };
    vendorId = vendor.id;
  }

  const { data: note, error } = await supabase
    .from("credit_notes")
    .insert({
      org_id: org.orgId,
      vendor_id: vendorId,
      supplier_name: supplierName,
      supplier_vat_number: text(input.supplierVatNumber, 40),
      credit_note_number: text(input.creditNoteNumber, 60),
      credit_date: input.creditDate,
      original_invoice_ref: text(input.originalInvoiceRef, 60),
      account_reference: text(input.accountReference, 60),
      reason: text(input.reason, 300),
      notes: text(input.notes, 1000),
      net_total: roundMoney(lines.reduce((s, l) => s + l.net, 0)),
      vat_total: roundMoney(lines.reduce((s, l) => s + l.vat, 0)),
      image_path: input.imagePath && input.imagePath.startsWith(`${org.orgId}/`) ? input.imagePath : null,
    })
    .select("id")
    .single();
  if (error?.code === "23505") return { error: "That credit note number is already recorded for this supplier." };
  if (error || !note) return { error: error?.message ?? "Couldn't save the credit note." };

  const { error: lineError } = await supabase.from("credit_note_lines").insert(
    lines.map((l, i) => ({
      credit_note_id: note.id,
      sort_order: i,
      description: l.description,
      qty: l.qty,
      unit_price: l.unitPrice,
      net_amount: l.net,
      vat_rate: l.vatRate,
      vat_amount: l.vat,
    }))
  );
  if (lineError) {
    await supabase.from("credit_notes").delete().eq("id", note.id);
    return { error: lineError.message };
  }

  refreshBookkeeping();
  return OK;
}

/** Open = still owed to you; applied = taken off a later bill; refunded = paid back to you. */
export async function setCreditNoteStatus(id: string, status: string, settledOn: string | null): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  if (!CREDIT_NOTE_STATUSES.includes(status)) return { error: "Invalid status." };
  if (status !== "open" && (!settledOn || !ISO_DATE.test(settledOn))) return { error: "Enter the date." };

  const { error } = await c.supabase
    .from("credit_notes")
    .update({ status, settled_on: status === "open" ? null : settledOn })
    .eq("id", id)
    .eq("org_id", c.org.orgId);
  if (error) return { error: error.message };
  refreshBookkeeping();
  return OK;
}

export async function deleteCreditNote(id: string): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  const { org, supabase } = c;

  const { data: note } = await supabase.from("credit_notes").select("id, image_path").eq("id", id).eq("org_id", org.orgId).maybeSingle();
  if (!note) return { error: "Credit note not found." };
  const { error } = await supabase.from("credit_notes").delete().eq("id", note.id);
  if (error) return { error: error.message };
  if (note.image_path) await supabase.storage.from("receipts").remove([note.image_path]);

  refreshBookkeeping();
  return OK;
}
