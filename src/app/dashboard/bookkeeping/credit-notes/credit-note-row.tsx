"use client";

import { useState } from "react";
import { ExpandableRow } from "@/components/expandable-row";
import { DateInput } from "@/components/date-input";
import { rowBtnPrimary, rowBtnSecondary, rowInputClass } from "@/components/bookkeeping/ui";
import { formatGBP } from "@/lib/format";
import { deleteCreditNote, setCreditNoteStatus } from "../credit-notes-actions";

export type CreditNoteData = {
  id: string;
  supplierName: string;
  supplierVatNumber: string | null;
  creditNoteNumber: string | null;
  creditDate: string;
  originalInvoiceRef: string | null;
  accountReference: string | null;
  reason: string | null;
  notes: string | null;
  status: string;
  settledOn: string | null;
  net: number;
  vat: number;
  gross: number;
  photoLink: string | null;
  lines: { id: string; description: string; qty: number; unit_price: number; net_amount: number; vat_rate: number; vat_amount: number }[];
};

const STATUS_LABEL: Record<string, string> = { open: "Open", applied: "Taken off a bill", refunded: "Refunded" };

export function CreditNoteRow({ row, today }: { row: CreditNoteData; today: string }) {
  const [mode, setMode] = useState<"none" | "applied" | "refunded">("none");
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<{ error: string | null }>) => {
    setBusy(true);
    setError(null);
    const result = await fn();
    setBusy(false);
    if (result.error) setError(result.error);
    else setMode("none");
  };

  const detail = (
    <div className="space-y-3 text-sm">
      <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {[
          ["Credit note no.", row.creditNoteNumber],
          ["Against invoice / PO", row.originalInvoiceRef],
          ["Your account ref", row.accountReference],
          ["Supplier VAT no.", row.supplierVatNumber],
          ["Reason", row.reason],
          ["Notes", row.notes],
        ]
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="text-slate-500 dark:text-slate-400">{k}:</dt>
              <dd className="text-slate-900 dark:text-slate-50">{v}</dd>
            </div>
          ))}
      </dl>
      <table className="w-full text-left text-sm">
        <thead className="text-slate-500 dark:text-slate-400">
          <tr>
            <th className="py-1 font-medium">Description</th>
            <th className="py-1 text-right font-medium">Qty</th>
            <th className="py-1 text-right font-medium">Unit price</th>
            <th className="py-1 text-right font-medium">Net</th>
            <th className="py-1 text-right font-medium">VAT</th>
          </tr>
        </thead>
        <tbody>
          {row.lines.map((l) => (
            <tr key={l.id} className="border-t border-slate-200 dark:border-slate-800">
              <td className="py-1">{l.description}</td>
              <td className="py-1 text-right">{l.qty}</td>
              <td className="py-1 text-right">{formatGBP(l.unit_price)}</td>
              <td className="py-1 text-right">{formatGBP(l.net_amount)}</td>
              <td className="py-1 text-right">
                {formatGBP(l.vat_amount)} <span className="text-xs text-slate-500">({l.vat_rate}%)</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-2">
        {row.status === "open" ? (
          <>
            <button type="button" onClick={() => setMode(mode === "applied" ? "none" : "applied")} className={rowBtnSecondary}>
              Taken off a bill
            </button>
            <button type="button" onClick={() => setMode(mode === "refunded" ? "none" : "refunded")} className={rowBtnSecondary}>
              Refunded to me
            </button>
          </>
        ) : (
          <button type="button" disabled={busy} onClick={() => run(() => setCreditNoteStatus(row.id, "open", null))} className={rowBtnSecondary}>
            Mark as open again
          </button>
        )}
        {row.photoLink ? (
          <a href={row.photoLink} target="_blank" rel="noreferrer" className="text-xs text-slate-600 underline dark:text-slate-300">
            See the photo
          </a>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (confirm(`Delete credit note ${row.creditNoteNumber ?? ""} from ${row.supplierName}?`)) void run(() => deleteCreditNote(row.id));
          }}
          className="ml-auto text-xs text-red-600 underline dark:text-red-400"
        >
          Delete
        </button>
      </div>
      {mode !== "none" ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <span className="text-slate-600 dark:text-slate-400">{mode === "applied" ? "Date it was taken off a bill" : "Date you got the money back"}</span>
          <DateInput value={date} onChange={(e) => setDate(e.target.value)} className={rowInputClass} />
          <button type="button" disabled={busy} onClick={() => run(() => setCreditNoteStatus(row.id, mode, date))} className={rowBtnPrimary}>
            Save
          </button>
        </div>
      ) : null}
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );

  return (
    <ExpandableRow
      colSpan={6}
      openLabel="Details"
      cells={
        <>
          <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-400">{row.creditDate}</td>
          <td className="px-4 py-3">
            <p className="text-slate-900 dark:text-slate-50">{row.supplierName}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {row.creditNoteNumber ? `No. ${row.creditNoteNumber}` : "No number"}
              {row.reason ? ` · ${row.reason}` : ""}
            </p>
          </td>
          <td className="whitespace-nowrap px-4 py-3">
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${
                row.status === "open"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
              }`}
            >
              {STATUS_LABEL[row.status] ?? row.status}
              {row.settledOn ? ` ${row.settledOn}` : ""}
            </span>
          </td>
          <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600 dark:text-slate-400">{formatGBP(row.vat)}</td>
          <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-50">{formatGBP(row.gross)}</td>
        </>
      }
      detail={detail}
    />
  );
}
