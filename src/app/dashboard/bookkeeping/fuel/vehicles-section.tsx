"use client";

import { useState } from "react";
import { btnPrimary, btnSecondary, FormNote, inputClass, labelClass, rowBtnSecondary, type FormStatus } from "@/components/bookkeeping/ui";
import { allowedVatMethods, CO2_BANDS, FUEL_TYPES, scaleChargeFor, VAT_METHODS, VEHICLE_TYPES, type VatMethod } from "@/lib/bookkeeping/fuel";
import { formatGBP } from "@/lib/format";
import { removeVehicle, saveVehicle, type VehicleInput } from "../fuel-actions";

export type VehicleRow = {
  id: string;
  name: string;
  registration: string | null;
  vehicle_type: string;
  fuel_type: string;
  private_use: boolean;
  vat_method: string;
  business_share_pct: number | null;
  co2_band: string | null;
};

const blank: VehicleInput = { name: "", registration: "", vehicleType: "Company van", fuelType: "Diesel", privateUse: false, vatMethod: "full", businessSharePct: null, co2Band: "" };

const toInput = (v: VehicleRow): VehicleInput => ({
  name: v.name,
  registration: v.registration ?? "",
  vehicleType: v.vehicle_type,
  fuelType: v.fuel_type,
  privateUse: v.private_use,
  vatMethod: v.vat_method,
  businessSharePct: v.business_share_pct,
  co2Band: v.co2_band ?? "",
});

/** What a vehicle's VAT setting means, in one line. */
export function describeVatMethod(v: Pick<VehicleRow, "vat_method" | "business_share_pct" | "co2_band">): string {
  if (v.vat_method === "business_share") return `Reclaim ${v.business_share_pct ?? 0}% of the VAT (business share)`;
  if (v.vat_method === "scale_charge") {
    const q = scaleChargeFor(v.co2_band, "2026-01-01", "2026-03-31");
    return `Reclaim all the VAT · scale charge ${q ? `${formatGBP(q.vat)} VAT a quarter` : ""} (CO2 ${v.co2_band})`;
  }
  return VAT_METHODS[v.vat_method as VatMethod] ?? v.vat_method;
}

function VehicleForm({ initial, id, onDone }: { initial: VehicleInput; id: string | null; onDone: () => void }) {
  const [v, setV] = useState<VehicleInput>(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<FormStatus>(null);
  const allowed = allowedVatMethods(v.vehicleType, v.privateUse);
  const set = (patch: Partial<VehicleInput>) =>
    setV((prev) => {
      const next = { ...prev, ...patch };
      const ok = allowedVatMethods(next.vehicleType, next.privateUse);
      if (!ok.includes(next.vatMethod as VatMethod)) next.vatMethod = ok[0];
      return next;
    });

  const save = async () => {
    setBusy(true);
    setNote(null);
    const result = await saveVehicle(id, v);
    setBusy(false);
    if (result.error) setNote({ ok: false, text: result.error });
    else onDone();
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={labelClass}>Name</label>
          <input value={v.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Market van" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Registration</label>
          <input value={v.registration} onChange={(e) => set({ registration: e.target.value })} placeholder="e.g. AB12 CDE" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Type of vehicle</label>
          <select value={v.vehicleType} onChange={(e) => set({ vehicleType: e.target.value })} className={inputClass}>
            {VEHICLE_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Fuel</label>
          <select value={v.fuelType} onChange={(e) => set({ fuelType: e.target.value })} className={inputClass}>
            {FUEL_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Private use</label>
          <select value={v.privateUse ? "yes" : "no"} onChange={(e) => set({ privateUse: e.target.value === "yes" })} className={inputClass}>
            <option value="no">No — business use only</option>
            <option value="yes">Yes — also used privately</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>VAT on its fuel</label>
          <select value={v.vatMethod} onChange={(e) => set({ vatMethod: e.target.value })} disabled={allowed.length === 1} className={inputClass}>
            {allowed.map((m) => (
              <option key={m} value={m}>
                {VAT_METHODS[m]}
              </option>
            ))}
          </select>
        </div>
        {v.vatMethod === "business_share" ? (
          <div>
            <label className={labelClass}>Business share %</label>
            <input
              type="number"
              min="0"
              max="100"
              value={v.businessSharePct ?? ""}
              onChange={(e) => set({ businessSharePct: e.target.value === "" ? null : Number(e.target.value) })}
              className={inputClass}
            />
          </div>
        ) : null}
        {v.vatMethod === "scale_charge" ? (
          <div>
            <label className={labelClass}>CO2 band (g/km)</label>
            <select value={v.co2Band} onChange={(e) => set({ co2Band: e.target.value })} className={inputClass}>
              <option value="">Pick from the V5C</option>
              {CO2_BANDS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      {v.privateUse && v.vehicleType !== "Company car" ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">Fuel scale charges only apply to cars, so a van or other vehicle used privately reclaims its business share, or nothing.</p>
      ) : null}
      {v.vatMethod === "business_share" ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">HMRC expects mileage records to back up the business share — keep them, even though the app doesn&apos;t track mileage yet.</p>
      ) : null}
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={save} className={btnPrimary}>
          {busy ? "Saving..." : "Save vehicle"}
        </button>
        <button type="button" onClick={onDone} className={btnSecondary}>
          Cancel
        </button>
      </div>
      <FormNote note={note} />
    </div>
  );
}

export function VehiclesSection({ vehicles }: { vehicles: VehicleRow[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-slate-50">Vehicles</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Each vehicle&apos;s type and private use decide how much VAT on its fuel can be reclaimed.</p>
        </div>
        {editing !== "new" ? (
          <button type="button" onClick={() => setEditing("new")} className={btnSecondary}>
            Add a vehicle
          </button>
        ) : null}
      </div>

      {editing === "new" ? (
        <div className="mt-4">
          <VehicleForm initial={blank} id={null} onDone={() => setEditing(null)} />
        </div>
      ) : null}

      <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
        {vehicles.map((v) =>
          editing === v.id ? (
            <li key={v.id} className="py-3">
              <VehicleForm initial={toInput(v)} id={v.id} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-50">
                  {v.name}
                  {v.registration ? <span className="ml-2 font-normal text-slate-500">{v.registration}</span> : null}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {v.vehicle_type} · {v.fuel_type} · {v.private_use ? "Also used privately" : "Business use only"} · {describeVatMethod(v)}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(v.id)} className={rowBtnSecondary}>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(`Remove ${v.name}? Receipts already saved keep their figures.`)) return;
                    const r = await removeVehicle(v.id);
                    setError(r.error);
                  }}
                  className={rowBtnSecondary}
                >
                  Remove
                </button>
              </div>
            </li>
          )
        )}
        {!vehicles.length && editing !== "new" ? <li className="py-3 text-sm text-slate-400">No vehicles yet — add the vans and cars the business fuels.</li> : null}
      </ul>
      {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
