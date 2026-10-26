"use client";

import { useState } from "react";
import { DateInput } from "@/components/date-input";
import { rowBtnPrimary, rowBtnSecondary, rowInputClass } from "@/components/bookkeeping/ui";
import { claimBadDebtRelief, reclaimPaidBillVat, repayBadDebtRelief, repayUnpaidBillVat, undoVatAdjustment } from "../bad-debts-actions";

const ACTIONS = {
  claim: claimBadDebtRelief,
  repayRelief: repayBadDebtRelief,
  repayBill: repayUnpaidBillVat,
  reclaimBill: reclaimPaidBillVat,
} as const;

/** One VAT adjustment button: opens a date picker (defaulting to today) and records it. */
export function AdjustButton({ action, id, label, today }: { action: keyof typeof ACTIONS; id: string; label: string; today: string }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    const r = await ACTIONS[action](id, date);
    setBusy(false);
    if (r.error) setError(r.error);
    else setOpen(false);
  };

  return (
    <div className="flex flex-col items-end gap-1">
      {open ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DateInput value={date} onChange={(e) => setDate(e.target.value)} className={rowInputClass} />
          <button type="button" disabled={busy} onClick={save} className={rowBtnPrimary}>
            Save
          </button>
          <button type="button" onClick={() => setOpen(false)} className={rowBtnSecondary}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={rowBtnSecondary}>
          {label}
        </button>
      )}
      {error ? <p className="max-w-xs text-right text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}

export function UndoAdjustment({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          if (!confirm("Undo this? It comes off the VAT return again.")) return;
          setError((await undoVatAdjustment(id)).error);
        }}
        className="text-xs text-slate-500 underline dark:text-slate-400"
      >
        Undo
      </button>
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </>
  );
}
