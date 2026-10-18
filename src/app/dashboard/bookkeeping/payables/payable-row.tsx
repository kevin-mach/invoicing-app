"use client";

import { useState } from "react";
import { DateInput } from "@/components/date-input";
import { VAT_RATES } from "@/lib/bookkeeping/categories";
import { formatGBP } from "@/lib/format";
import { rowBtnPrimary, rowBtnSecondary, rowInputClass } from "@/components/bookkeeping/ui";
import { markPurchasePaid, markPurchaseUnpaid, updateBillDetails } from "../payables-actions";

export type PayableData = {
  id: string;
  vendorName: string;
  supplierRef: string | null;
  purchaseDate: string;
  dueDate: string | null;
  due: string;
  daysOverdue: number;
  paidOn: string | null;
  net: number;
  vat: number;
  gross: number;
  possibleDuplicate: boolean;
};

const inputClass = rowInputClass;
const smallButton = rowBtnSecondary;
const primaryButton = rowBtnPrimary;

export function PayableRow({ row, today }: { row: PayableData; today: string }) {
  const [mode, setMode] = useState<"none" | "pay" | "edit">("none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paidOn, setPaidOn] = useState(today);
  const [ref, setRef] = useState(row.supplierRef ?? "");
  const [dueDate, setDueDate] = useState(row.dueDate ?? "");
  const [vatRate, setVatRate] = useState<string>("");

  const run = async (fn: () => Promise<{ error: string | null }>) => {
    setBusy(true);
    setError(null);
    const result = await fn();
    setBusy(false);
    if (result.error) setError(result.error);
    else setMode("none");
  };

  return (
    <tr className="border-b border-slate-100 align-top last:border-0 dark:border-slate-800">
      <td className="px-4 py-3">
        <p className="font-medium text-slate-900 dark:text-slate-50">{row.vendorName}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{row.supplierRef ? `Ref ${row.supplierRef}` : "No supplier ref"}</p>
        {row.possibleDuplicate ? (
          <span className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Possible duplicate
          </span>
        ) : null}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-400">{row.purchaseDate}</td>
      <td className="whitespace-nowrap px-4 py-3">
        {row.paidOn ? (
          <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
            Paid {row.paidOn}
          </span>
        ) : (
          <>
            <p className="text-slate-600 dark:text-slate-400">{row.due}</p>
            {row.daysOverdue > 0 ? (
              <p className="text-xs font-medium text-red-600 dark:text-red-400">{row.daysOverdue} days overdue</p>
            ) : null}
          </>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600 dark:text-slate-400">{formatGBP(row.net)}</td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600 dark:text-slate-400">{formatGBP(row.vat)}</td>
      <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-50">
        {formatGBP(row.gross)}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {row.paidOn ? (
            <button type="button" disabled={busy} onClick={() => run(() => markPurchaseUnpaid(row.id))} className={smallButton}>
              Mark unpaid
            </button>
          ) : (
            <button type="button" onClick={() => setMode(mode === "pay" ? "none" : "pay")} className={smallButton}>
              {mode === "pay" ? "Close" : "Mark paid"}
            </button>
          )}
          <button type="button" onClick={() => setMode(mode === "edit" ? "none" : "edit")} className={smallButton}>
            {mode === "edit" ? "Close" : "Edit"}
          </button>
        </div>

        {mode === "pay" ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <DateInput value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={inputClass} />
            <button type="button" disabled={busy} onClick={() => run(() => markPurchasePaid(row.id, paidOn))} className={primaryButton}>
              Save
            </button>
          </div>
        ) : null}

        {mode === "edit" ? (
          <div className="mt-2 space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="Supplier invoice no."
                className={`${inputClass} w-44`}
              />
              <DateInput value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} title="Due date" />
              <select value={vatRate} onChange={(e) => setVatRate(e.target.value)} className={inputClass}>
                <option value="">VAT: leave as is</option>
                {VAT_RATES.map((r) => (
                  <option key={r} value={r}>
                    Set all lines to {r}%
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(() => updateBillDetails(row.id, { supplierRef: ref, dueDate, vatRate: vatRate === "" ? null : Number(vatRate) }))
                }
                className={primaryButton}
              >
                Save
              </button>
            </div>
          </div>
        ) : null}
        {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
      </td>
    </tr>
  );
}
