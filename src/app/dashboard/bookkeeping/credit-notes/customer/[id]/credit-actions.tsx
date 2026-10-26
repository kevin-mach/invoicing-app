"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DateInput } from "@/components/date-input";
import { rowBtnPrimary, rowBtnSecondary, rowInputClass } from "@/components/bookkeeping/ui";
import { applyCustomerCreditNote, deleteCustomerCreditNote, refundCustomerCreditNote, reopenCustomerCreditNote } from "../../../customer-credit-notes-actions";

/** Print, settle (take off the invoice / refunded), reopen or delete a customer credit note. */
export function CustomerCreditActions({ id, status, hasInvoice, today }: { id: string; status: string; hasInvoice: boolean; today: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "apply" | "refund">("none");
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<{ error: string | null }>, after?: () => void) => {
    setBusy(true);
    setError(null);
    const r = await fn();
    setBusy(false);
    if (r.error) return setError(r.error);
    setMode("none");
    after?.();
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => window.print()} className={rowBtnSecondary}>
          Print / save PDF
        </button>
        {status === "open" ? (
          <>
            {hasInvoice ? (
              <button type="button" onClick={() => setMode(mode === "apply" ? "none" : "apply")} className={rowBtnSecondary}>
                Take off the invoice
              </button>
            ) : null}
            <button type="button" onClick={() => setMode(mode === "refund" ? "none" : "refund")} className={rowBtnSecondary}>
              Refunded to customer
            </button>
          </>
        ) : (
          <button type="button" disabled={busy} onClick={() => run(() => reopenCustomerCreditNote(id))} className={rowBtnSecondary}>
            Mark as open again
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (confirm("Delete this credit note? If it was taken off an invoice, the invoice owes that amount again."))
              void run(() => deleteCustomerCreditNote(id), () => router.push("/dashboard/bookkeeping/credit-notes?view=customers"));
          }}
          className="text-xs text-red-600 underline dark:text-red-400"
        >
          Delete
        </button>
      </div>
      {mode !== "none" ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-800">
          <span className="text-slate-600 dark:text-slate-400">{mode === "apply" ? "Taken off on" : "Refunded on"}</span>
          <DateInput value={date} onChange={(e) => setDate(e.target.value)} className={rowInputClass} />
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => (mode === "apply" ? applyCustomerCreditNote(id, date) : refundCustomerCreditNote(id, date)))}
            className={rowBtnPrimary}
          >
            Save
          </button>
        </div>
      ) : null}
      {error ? <p className="max-w-sm text-right text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
