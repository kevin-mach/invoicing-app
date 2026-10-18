"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { DateInput } from "@/components/date-input";
import { PAYMENT_METHODS } from "@/lib/bookkeeping/categories";
import { formatGBP } from "@/lib/format";
import { rowBtnPrimary, rowBtnSecondary, rowInputClass } from "@/components/bookkeeping/ui";
import { deleteInvoicePayment, recordInvoicePayment } from "../receivables-actions";

export type ReceivableData = {
  id: string;
  number: string;
  customerName: string;
  customerEmail: string | null;
  issueDate: string;
  due: string;
  daysOverdue: number;
  total: number;
  paid: number;
  outstanding: number;
  payments: { id: string; amount: number; paid_on: string; method: string; reference: string | null }[];
};

const inputClass = rowInputClass;
const smallButton = rowBtnSecondary;
const primaryButton = rowBtnPrimary;

function chaseLink(r: ReceivableData): string | null {
  if (!r.customerEmail) return null;
  const subject = `Invoice ${r.number} — payment reminder`;
  const body = `Hi ${r.customerName},\n\nJust a friendly reminder that invoice ${r.number} (${formatGBP(r.total)}, dated ${r.issueDate}) has ${formatGBP(r.outstanding)} outstanding${
    r.daysOverdue > 0 ? ` and was due on ${r.due}` : ` and is due on ${r.due}`
  }.\n\nCould you let me know when payment will be made? If it has already gone out, please ignore this message.\n\nThank you.`;
  return `mailto:${r.customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Removes a recorded payment (reopening the invoice if it's no longer fully paid). */
export function RemovePaymentButton({ paymentId, viaBank }: { paymentId: string; viaBank: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          const message = viaBank
            ? "Remove this payment? The bank line goes back to Unreviewed, and the invoice reopens if it's no longer fully paid."
            : "Remove this payment? The invoice reopens if it's no longer fully paid.";
          if (!confirm(message)) return;
          setBusy(true);
          const result = await deleteInvoicePayment(paymentId);
          setBusy(false);
          if (result.error) setError(result.error);
        }}
        className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-60"
      >
        Remove
      </button>
      {error ? <span className="ml-2 text-xs text-red-600">{error}</span> : null}
    </span>
  );
}

export function ReceivableRow({ row, today }: { row: ReceivableData; today: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState(String(row.outstanding));
  const [paidOn, setPaidOn] = useState(today);
  const [method, setMethod] = useState<string>("bank");
  const [reference, setReference] = useState("");
  const chase = chaseLink(row);

  // The row component outlives a saved payment, so re-seed the form from the latest balance each
  // time it's opened — otherwise it would keep offering the previous amount.
  const toggle = () => {
    if (!open) {
      setAmount(String(row.outstanding));
      setPaidOn(today);
      setReference("");
      setError(null);
    }
    setOpen((v) => !v);
  };

  const save = async () => {
    const value = Number(amount);
    if (
      value > row.outstanding + 0.005 &&
      !confirm(`${formatGBP(value)} is more than the ${formatGBP(row.outstanding)} still outstanding. Record it anyway?`)
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = await recordInvoicePayment(row.id, { amount: value, paidOn, method, reference });
    setBusy(false);
    if (result.error) setError(result.error);
    else setOpen(false);
  };

  const remove = async (paymentId: string) => {
    if (!confirm("Remove this payment? The invoice is reopened if it's no longer fully paid.")) return;
    setBusy(true);
    const result = await deleteInvoicePayment(paymentId);
    setBusy(false);
    if (result.error) setError(result.error);
  };

  return (
    <tr className="border-b border-slate-100 align-top last:border-0 dark:border-slate-800">
      <td className="px-4 py-3">
        <p className="font-medium text-slate-900 dark:text-slate-50">{row.number}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{row.customerName}</p>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-400">{row.issueDate}</td>
      <td className="whitespace-nowrap px-4 py-3">
        <p className="text-slate-600 dark:text-slate-400">{row.due}</p>
        {row.daysOverdue > 0 ? (
          <p className="text-xs font-medium text-red-600 dark:text-red-400">{row.daysOverdue} days overdue</p>
        ) : null}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600 dark:text-slate-400">{formatGBP(row.total)}</td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600 dark:text-slate-400">{formatGBP(row.paid)}</td>
      <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-50">
        {formatGBP(row.outstanding)}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={toggle} className={smallButton}>
            {open ? "Close" : "Record payment"}
          </button>
          {chase ? (
            <a href={chase} className={`${smallButton} flex items-center gap-1`}>
              <Mail size={12} /> Chase
            </a>
          ) : null}
        </div>

        {open ? (
          <div className="mt-2 space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${inputClass} w-24 text-right`}
                aria-label="Amount"
              />
              <DateInput value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={inputClass} />
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={`${inputClass} capitalize`}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Reference (optional)"
                className={`${inputClass} w-40`}
              />
              <button type="button" disabled={busy} onClick={save} className={primaryButton}>
                {busy ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : null}

        {row.payments.length ? (
          <ul className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
            {row.payments.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <span>
                  {formatGBP(p.amount)} on {p.paid_on} ({p.method}
                  {p.reference ? `, ${p.reference}` : ""})
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(p.id)}
                  className="text-slate-400 hover:text-red-600"
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
      </td>
    </tr>
  );
}
