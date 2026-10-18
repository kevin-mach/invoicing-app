"use client";

import { useState } from "react";
import { EXPENSE_CATEGORIES, VAT_RATES } from "@/lib/bookkeeping/categories";
import { formatGBP } from "@/lib/format";
import type { ActionResult } from "@/lib/bookkeeping/server-actions";
import { rowBtnPrimary, rowBtnSecondary, rowSelectClass } from "@/components/bookkeeping/ui";
import {
  ignoreBankTransaction,
  matchBankToInvoice,
  matchBankToPurchase,
  recordBankAsExpense,
  unmatchBankTransaction,
} from "../bank-actions";

export type BankOption = { id: string; label: string };
export type BankSuggestion = { kind: "invoice" | "purchase"; id: string; label: string };

export type BankRowData = {
  id: string;
  txn_date: string;
  description: string;
  amount: number;
  status: string;
  matchedLabel: string | null;
  note: string | null;
};

const selectClass = rowSelectClass;
const smallButton = rowBtnSecondary;
const primaryButton = rowBtnPrimary;

const STATUS_STYLE: Record<string, string> = {
  unreviewed: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  matched: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  ignored: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export function BankRow({
  txn,
  suggestions,
  categorySuggestion,
  invoiceOptions,
  purchaseOptions,
}: {
  txn: BankRowData;
  suggestions: BankSuggestion[];
  categorySuggestion: string;
  invoiceOptions: BankOption[];
  purchaseOptions: BankOption[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [category, setCategory] = useState(categorySuggestion);
  const [vatRate, setVatRate] = useState<number>(0);

  const isCredit = txn.amount > 0;
  const options = isCredit ? invoiceOptions : purchaseOptions;

  const run = async (fn: () => Promise<ActionResult>) => {
    setBusy(true);
    setError(null);
    const result = await fn();
    setBusy(false);
    if (result.error) setError(result.error);
    else setOpen(false);
  };

  const match = (kind: "invoice" | "purchase", id: string) =>
    run(() => (kind === "invoice" ? matchBankToInvoice(txn.id, id) : matchBankToPurchase(txn.id, id)));

  return (
    <tr className="border-b border-slate-100 align-top last:border-0 dark:border-slate-800">
      <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-400">{txn.txn_date}</td>
      <td className="px-4 py-3 text-slate-900 dark:text-slate-50">{txn.description}</td>
      <td
        className={`whitespace-nowrap px-4 py-3 text-right font-medium ${isCredit ? "text-green-600 dark:text-green-400" : "text-slate-900 dark:text-slate-50"}`}
      >
        {formatGBP(txn.amount)}
      </td>
      <td className="px-4 py-3">
        <span className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[txn.status]}`}>
          {txn.status}
        </span>
        {txn.matchedLabel ? (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{txn.matchedLabel}</p>
        ) : null}
        {txn.status === "matched" && txn.note?.startsWith("Auto-") ? (
          <p className="mt-1 text-xs italic text-slate-400 dark:text-slate-500">{txn.note} — check &amp; Undo if wrong</p>
        ) : null}
      </td>
      <td className="px-4 py-3">
        {txn.status === "unreviewed" ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button key={s.id} disabled={busy} onClick={() => match(s.kind, s.id)} className={primaryButton}>
                  Match {s.label}
                </button>
              ))}
              <button type="button" disabled={busy} onClick={() => setOpen((v) => !v)} className={smallButton}>
                {open ? "Close" : isCredit ? "Match to invoice…" : "Match / categorise…"}
              </button>
              <button type="button" disabled={busy} onClick={() => run(() => ignoreBankTransaction(txn.id))} className={smallButton}>
                Ignore
              </button>
            </div>

            {open ? (
              <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <select value={target} onChange={(e) => setTarget(e.target.value)} className={`${selectClass} max-w-xs`}>
                    <option value="">{isCredit ? "Choose an open invoice…" : "Choose an unpaid bill…"}</option>
                    {options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={busy || !target}
                    onClick={() => match(isCredit ? "invoice" : "purchase", target)}
                    className={primaryButton}
                  >
                    Match
                  </button>
                </div>

                {!isCredit ? (
                  <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                    <span className="text-xs text-slate-500 dark:text-slate-400">or record as expense:</span>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
                      <option value="">Category…</option>
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <select value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))} className={selectClass}>
                      {VAT_RATES.map((r) => (
                        <option key={r} value={r}>
                          {r === 0 ? "No VAT" : `${r}% VAT incl.`}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busy || !category}
                      onClick={() => run(() => recordBankAsExpense(txn.id, category, vatRate))}
                      className={primaryButton}
                    >
                      Record expense
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <button type="button" disabled={busy} onClick={() => run(() => unmatchBankTransaction(txn.id))} className={smallButton}>
            Undo
          </button>
        )}
        {categorySuggestion && txn.status === "unreviewed" && !open ? (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Usually categorised as {categorySuggestion}</p>
        ) : null}
        {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
      </td>
    </tr>
  );
}
