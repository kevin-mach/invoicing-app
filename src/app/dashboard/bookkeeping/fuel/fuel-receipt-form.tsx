"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ScanButton } from "@/components/bookkeeping/scan-button";
import { DateInput } from "@/components/date-input";
import { btnPrimary, FormNote, inputClass, labelClass, type FormStatus } from "@/components/bookkeeping/ui";
import { reclaimPctFor, vatInFuel } from "@/lib/bookkeeping/fuel";
import { formatGBP, roundMoney } from "@/lib/format";
import type { ScanExtraction } from "@/lib/scan/extract";
import { saveFuelReceipt } from "../fuel-actions";
import type { VehicleRow } from "./vehicles-section";

const empty = (today: string) => ({
  vehicleId: "",
  date: today,
  station: "",
  stationVatNumber: "",
  fuelType: "Diesel",
  litres: "",
  pricePerLitre: "",
  total: "",
  vatOnReceipt: "",
  paymentMethod: "card",
  notes: "",
});

const normalisePlate = (s: string) => s.replace(/\s+/g, "").toUpperCase();

/** Scan or type in a fuel receipt. Shows how much of its VAT can be reclaimed for the chosen vehicle. */
export function FuelReceiptForm({ orgId, today, vehicles }: { orgId: string; today: string; vehicles: VehicleRow[] }) {
  const [f, setF] = useState(empty(today));
  const [file, setFile] = useState<File | null>(null);
  const [vatPrinted, setVatPrinted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<FormStatus>(null);
  const set = (patch: Partial<typeof f>) => setF((prev) => ({ ...prev, ...patch }));

  const handleScanned = (data: ScanExtraction, scanned: File) => {
    if (data.kind !== "fuel") return;
    setNote(null);
    setFile(scanned);
    const byPlate = data.registration ? vehicles.find((v) => v.registration && normalisePlate(v.registration) === normalisePlate(data.registration ?? "")) : undefined;
    const fuelVehicles = vehicles.filter((v) => !data.fuelType || v.fuel_type === data.fuelType);
    const vehicle = byPlate ?? (fuelVehicles.length === 1 ? fuelVehicles[0] : vehicles.length === 1 ? vehicles[0] : undefined);
    setVatPrinted(data.vatAmount !== null);
    setF({
      vehicleId: vehicle?.id ?? "",
      date: data.date ?? today,
      station: data.station ?? "",
      stationVatNumber: data.stationVatNumber ?? "",
      fuelType: data.fuelType && data.fuelType !== "AdBlue" ? data.fuelType : "Diesel",
      litres: data.litres?.toString() ?? "",
      pricePerLitre: data.pricePerLitre?.toString() ?? "",
      total: data.total?.toString() ?? "",
      vatOnReceipt: (data.vatAmount ?? (data.total ? vatInFuel(data.total) : 0)).toString(),
      paymentMethod: data.paymentMethod ?? "card",
      notes: data.fuelType === "AdBlue" ? "AdBlue" : "",
    });
  };

  const total = Number(f.total) || 0;
  const vat = Number(f.vatOnReceipt) || 0;
  const vehicle = vehicles.find((v) => v.id === f.vehicleId) ?? null;
  const pct = f.stationVatNumber.trim() ? reclaimPctFor(vehicle) : 0;
  const reclaim = roundMoney((vat * pct) / 100);

  const save = async () => {
    setBusy(true);
    setNote(null);
    let receiptPath: string | null = null;
    if (file) {
      const ext = file.name.split(".").pop() || "jpg";
      receiptPath = `${orgId}/fuel/${crypto.randomUUID()}.${ext}`;
      const { error } = await createClient().storage.from("receipts").upload(receiptPath, file);
      if (error) {
        setBusy(false);
        setNote({ ok: false, text: `Couldn't upload the photo: ${error.message}` });
        return;
      }
    }
    const result = await saveFuelReceipt({
      vehicleId: f.vehicleId || null,
      date: f.date,
      station: f.station,
      stationVatNumber: f.stationVatNumber,
      fuelType: f.fuelType,
      litres: f.litres ? Number(f.litres) : null,
      pricePerLitre: f.pricePerLitre ? Number(f.pricePerLitre) : null,
      total,
      vatOnReceipt: vat,
      paymentMethod: f.paymentMethod,
      receiptPath,
      notes: f.notes,
    });
    setBusy(false);
    if (result.error) {
      if (receiptPath) await createClient().storage.from("receipts").remove([receiptPath]);
      setNote({ ok: false, text: result.error });
      return;
    }
    setF(empty(today));
    setFile(null);
    setNote({ ok: true, text: "Fuel receipt saved — its VAT is in the VAT return and it's listed under Expenses as Fuel." });
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-slate-50">Add a fuel receipt</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Scan the receipt from the pump, pick the vehicle, check and save.</p>
        </div>
        <ScanButton kind="fuel" label="Scan a fuel receipt" onExtracted={handleScanned} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={labelClass}>Vehicle</label>
          <select value={f.vehicleId} onChange={(e) => set({ vehicleId: e.target.value })} className={inputClass}>
            <option value="">Not linked to a vehicle</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.registration ? ` (${v.registration})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Date</label>
          <DateInput value={f.date} onChange={(e) => set({ date: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Filling station</label>
          <input value={f.station} onChange={(e) => set({ station: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Station VAT number</label>
          <input value={f.stationVatNumber} onChange={(e) => set({ stationVatNumber: e.target.value })} placeholder="GB…" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Fuel</label>
          <select value={f.fuelType} onChange={(e) => set({ fuelType: e.target.value })} className={inputClass}>
            {["Diesel", "Petrol", "LPG", "Electric"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Litres</label>
          <input type="number" step="0.01" min="0" value={f.litres} onChange={(e) => set({ litres: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Total paid (inc VAT)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={f.total}
            onChange={(e) => set({ total: e.target.value, ...(vatPrinted ? {} : { vatOnReceipt: vatInFuel(Number(e.target.value) || 0).toString() }) })}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>VAT on the receipt</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={f.vatOnReceipt}
            onChange={(e) => {
              setVatPrinted(true);
              set({ vatOnReceipt: e.target.value });
            }}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Paid by</label>
          <select value={f.paymentMethod} onChange={(e) => set({ paymentMethod: e.target.value })} className={inputClass}>
            <option value="card">Card</option>
            <option value="cash">Cash</option>
            <option value="bank">Fuel card / account</option>
          </select>
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className={labelClass}>Notes</label>
          <input value={f.notes} onChange={(e) => set({ notes: e.target.value })} className={inputClass} />
        </div>
      </div>

      {total > 0 ? (
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-300">
          {!f.stationVatNumber.trim() ? (
            <span className="text-amber-700 dark:text-amber-400">No VAT number on the receipt, so its VAT can&apos;t be reclaimed. Add it if it&apos;s printed.</span>
          ) : (
            <>
              VAT you can reclaim: <span className="font-semibold">{formatGBP(reclaim)}</span> of {formatGBP(vat)} ({pct}%
              {vehicle ? ` — ${vehicle.name}` : " — no vehicle picked, so treated as business use"}).
            </>
          )}{" "}
          Cost to the business: {formatGBP(roundMoney(total - reclaim))}.
        </div>
      ) : null}

      <div>
        <button type="button" disabled={busy} onClick={save} className={btnPrimary}>
          {busy ? "Saving..." : "Save fuel receipt"}
        </button>
        <FormNote note={note} />
      </div>
    </div>
  );
}
