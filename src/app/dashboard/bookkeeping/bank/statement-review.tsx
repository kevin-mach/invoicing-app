"use client";

import { AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";
import { DateInput } from "@/components/date-input";
import { formatGBP, roundMoney } from "@/lib/format";
import { btnPrimary, btnSecondary } from "@/components/bookkeeping/ui";
import type { StatementCheck, StatementRow } from "@/lib/scan/statement-math";

export type StatementDraft = {
  accountLabel: string;
  periodFrom: string | null;
  periodTo: string | null;
  openingBalance: number | null;
  closingBalance: number | null;
  checks: StatementCheck[];
  rows: (StatementRow & { key: string })[];
};

const cell = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50";

/** A scanned bank statement page as a table to check before it goes into the Bank tab: every
 * row, money in or out, the running balance, and whether the page adds up to its own totals. */
export function StatementReview({
  draft,
  onChange,
  onImport,
  onDiscard,
  busy,
}: {
  draft: StatementDraft;
  onChange: (next: StatementDraft) => void;
  onImport: () => void;
  onDiscard: () => void;
  busy: boolean;
}) {
  const setRow = (key: string, patch: Partial<StatementRow>) =>
    onChange({ ...draft, rows: draft.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) });

  const totalIn = roundMoney(draft.rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0));
  const totalOut = roundMoney(draft.rows.filter((r) => r.amount < 0).reduce((s, r) => s - r.amount, 0));
  const flagged = draft.rows.filter((r) => r.check).length;

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <div>
        <h3 className="font-semibold text-slate-900 dark:text-slate-50">Check this statement</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {draft.accountLabel || "Bank statement"}
          {draft.periodFrom && draft.periodTo ? ` · ${draft.periodFrom} to ${draft.periodTo}` : ""}
          {draft.openingBalance !== null && draft.closingBalance !== null
            ? ` · balance ${formatGBP(draft.openingBalance)} → ${formatGBP(draft.closingBalance)}`
            : ""}
        </p>
      </div>

      <ul className="space-y-1.5">
        {draft.checks.map((c) => (
          <li key={c.text} className={`flex gap-2 text-sm ${c.ok ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}>
            {c.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
            <span>{c.text}</span>
          </li>
        ))}
      </ul>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="lines w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="w-36 px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="w-28 px-3 py-2 text-right font-medium">Paid in</th>
              <th className="w-28 px-3 py-2 text-right font-medium">Withdrawn</th>
              <th className="w-28 px-3 py-2 text-right font-medium">Balance</th>
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {draft.rows.map((r) => (
              <tr key={r.key} className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${r.check ? "bg-amber-50/60 dark:bg-amber-950/20" : ""}`}>
                <td className="px-3 py-2" data-label="Date">
                  <DateInput value={r.date} onChange={(e) => setRow(r.key, { date: e.target.value })} className={cell} />
                </td>
                <td className="px-3 py-2" data-label="Description" data-wide>
                  <input value={r.description} onChange={(e) => setRow(r.key, { description: e.target.value })} className={cell} />
                  {r.problem ? <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">{r.problem}</p> : null}
                </td>
                <td className="px-3 py-2 text-right text-green-700 dark:text-green-400" data-label="Paid in">
                  {r.amount > 0 ? formatGBP(r.amount) : "—"}
                </td>
                <td className="px-3 py-2 text-right text-slate-900 dark:text-slate-50" data-label="Withdrawn">
                  {r.amount < 0 ? formatGBP(-r.amount) : "—"}
                </td>
                <td className="px-3 py-2 text-right text-slate-500 dark:text-slate-400" data-label="Balance">
                  {r.balance !== null ? formatGBP(r.balance) : "—"}
                </td>
                <td className="px-3 py-2 text-right" data-remove>
                  <button
                    type="button"
                    onClick={() => onChange({ ...draft, rows: draft.rows.filter((x) => x.key !== r.key) })}
                    className="text-slate-400 hover:text-red-600"
                    aria-label={`Remove ${r.description}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-400">
        {draft.rows.length} transaction{draft.rows.length === 1 ? "" : "s"} · {formatGBP(totalIn)} in · {formatGBP(totalOut)} out
        {flagged ? ` · ${flagged} to double-check` : ""}
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" disabled={busy || !draft.rows.length} onClick={onImport} className={`${btnPrimary} min-h-11 w-full sm:w-auto`}>
          {busy ? "Importing..." : `Import ${draft.rows.length} transaction${draft.rows.length === 1 ? "" : "s"}`}
        </button>
        <button type="button" disabled={busy} onClick={onDiscard} className={`${btnSecondary} min-h-11 w-full sm:w-auto`}>
          Discard
        </button>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Lines already on file are skipped, so scanning an overlapping statement is safe. Each line is marked with the account it came from.
      </p>
    </div>
  );
}
