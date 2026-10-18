"use client";

import { useState } from "react";
import { btnPrimary, FormNote, inputClass, labelClass, type FormStatus } from "@/components/bookkeeping/ui";
import { updateVatSettings } from "../actions";

export function VatSettings({
  addVatToTotal,
  vatNumber,
  canEdit,
}: {
  addVatToTotal: boolean;
  vatNumber: string;
  canEdit: boolean;
}) {
  const [on, setOn] = useState(addVatToTotal);
  const [vrn, setVrn] = useState(vatNumber);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<FormStatus>(null);

  const save = async () => {
    setBusy(true);
    setNote(null);
    const result = await updateVatSettings({ addVatToTotal: on, vatNumber: vrn });
    setBusy(false);
    setNote(result.error ? { ok: false, text: result.error } : { ok: true, text: "Saved." });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="font-semibold text-slate-900 dark:text-slate-50">VAT settings</h2>

      <label className="mt-3 flex items-start gap-3">
        <input
          type="checkbox"
          checked={on}
          disabled={!canEdit}
          onChange={(e) => setOn(e.target.checked)}
          className="mt-1"
        />
        <span className="text-sm">
          <span className="font-medium text-slate-900 dark:text-slate-50">Add VAT on top of invoice totals</span>
          <span className="block text-slate-500 dark:text-slate-400">
            Off (the default): VAT is shown on invoices but the total is the net amount, exactly as before. On: new
            invoices start with &ldquo;Add VAT to the total&rdquo; ticked, so the total includes VAT. You can still
            change it on any individual invoice, and turning this on never alters invoices that already exist.
          </span>
        </span>
      </label>

      <div className="mt-4 max-w-xs">
        <label className={labelClass}>VAT registration number</label>
        <input
          value={vrn}
          disabled={!canEdit}
          onChange={(e) => setVrn(e.target.value)}
          placeholder="e.g. 123456789"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Needed to file VAT returns with HMRC.</p>
      </div>

      {canEdit ? (
        <div className="mt-4 flex items-center gap-3">
          <button type="button" disabled={busy} onClick={save} className={btnPrimary}>
            {busy ? "Saving..." : "Save VAT settings"}
          </button>
          <FormNote note={note} className="text-sm" />
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Only the owner or an admin can change these.</p>
      )}
    </div>
  );
}
