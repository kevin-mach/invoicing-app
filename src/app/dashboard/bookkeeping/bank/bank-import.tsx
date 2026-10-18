"use client";

import { useMemo, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { parseSpreadsheetFile } from "@/lib/csv/parse";
import { detectBankColumns, parseBankRows, type BankColumns } from "@/lib/bookkeeping/bank-csv";
import { formatGBP, roundMoney } from "@/lib/format";
import { btnPrimary, btnSecondary, rowSelectClass } from "@/components/bookkeeping/ui";
import { importBankTransactions } from "../bank-actions";

const COLUMN_FIELDS: { key: keyof BankColumns; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "description", label: "Description" },
  { key: "amount", label: "Amount (in +, out −)" },
  { key: "debit", label: "Money out (debit)" },
  { key: "credit", label: "Money in (credit)" },
];

const selectClass = `mt-1 w-full ${rowSelectClass}`;

export function BankImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [columns, setColumns] = useState<BankColumns>({});
  const [invert, setInvert] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const headers = useMemo(() => (rows.length ? Object.keys(rows[0]) : []), [rows]);
  const parsed = useMemo(() => parseBankRows(rows, columns, { invertSigns: invert }), [rows, columns, invert]);

  const totalIn = roundMoney(parsed.transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0));
  const totalOut = roundMoney(parsed.transactions.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0));
  const allOneWay =
    parsed.transactions.length > 3 &&
    (parsed.transactions.every((t) => t.amount < 0) || parsed.transactions.every((t) => t.amount > 0));

  const reset = () => {
    setRows([]);
    setFileName("");
    setColumns({});
    setInvert(false);
  };

  const handleFile = async (file: File) => {
    setMessage(null);
    try {
      const parsedRows = await parseSpreadsheetFile(file);
      if (!parsedRows.length) {
        setMessage({ kind: "error", text: "That file has no rows." });
        return;
      }
      setRows(parsedRows);
      setFileName(file.name);
      setColumns(detectBankColumns(Object.keys(parsedRows[0])));
    } catch {
      setMessage({ kind: "error", text: "Couldn't read that file. Use a .csv or .xlsx bank statement export." });
    }
  };

  const handleImport = async () => {
    setBusy(true);
    setMessage(null);
    const result = await importBankTransactions(parsed.transactions);
    setBusy(false);
    if (result.error) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    const autoBits = [
      result.autoMatched ? `${result.autoMatched} auto-matched` : "",
      result.autoBanked ? `${result.autoBanked} cash-up${result.autoBanked === 1 ? "" : "s"} banked` : "",
      result.autoPayroll ? `${result.autoPayroll} payroll payment${result.autoPayroll === 1 ? "" : "s"} matched` : "",
      result.autoCategorised ? `${result.autoCategorised} auto-categorised` : "",
    ].filter(Boolean);
    const auto = autoBits.length ? ` ${autoBits.join(", ")} — check them under Bank.` : "";
    setMessage({
      kind: "ok",
      text: `Imported ${result.inserted} new transaction${result.inserted === 1 ? "" : "s"}${
        result.skipped ? `, skipped ${result.skipped} already on file` : ""
      }.${auto}`,
    });
    reset();
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-slate-50">Import a bank statement</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Download a CSV or Excel export from your online banking. Re-importing overlapping statements is safe —
            lines already on file are skipped.
          </p>
        </div>
        <button type="button" onClick={() => inputRef.current?.click()} className={`flex items-center gap-1 ${btnSecondary}`}>
          <Upload size={16} /> Choose file
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {message ? (
        <p
          className={`mt-3 rounded-md px-3 py-2 text-sm ${
            message.kind === "ok"
              ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
              : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      {rows.length ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            <span className="font-medium">{fileName}</span> — {rows.length} rows. Check the columns were matched
            correctly.
          </p>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {COLUMN_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">{f.label}</label>
                <select
                  value={columns[f.key] ?? ""}
                  onChange={(e) => setColumns((c) => ({ ...c, [f.key]: e.target.value || undefined }))}
                  className={selectClass}
                >
                  <option value="">— none —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Use either one Amount column, or separate money-out and money-in columns.
          </p>

          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} />
            Flip signs (tick if money in shows as negative — common on credit-card statements)
          </label>

          {parsed.problems.length ? (
            <ul className="list-disc pl-5 text-sm text-amber-700 dark:text-amber-400">
              {parsed.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}

          {parsed.transactions.length ? (
            <>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="px-3 py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.transactions.slice(0, 6).map((t, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                        <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">{t.txn_date}</td>
                        <td className="px-3 py-1.5 text-slate-900 dark:text-slate-50">{t.description}</td>
                        <td
                          className={`px-3 py-1.5 text-right ${t.amount >= 0 ? "text-green-600 dark:text-green-400" : "text-slate-900 dark:text-slate-50"}`}
                        >
                          {formatGBP(t.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {parsed.transactions.length} transactions to import · {formatGBP(totalIn)} in · {formatGBP(totalOut)} out
                {parsed.skipped ? ` · ${parsed.skipped} rows skipped` : ""}
              </p>
              {allOneWay ? (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  Every line is {parsed.transactions[0].amount < 0 ? "money out" : "money in"}. If that looks wrong,
                  tick &ldquo;Flip signs&rdquo;.
                </p>
              ) : null}
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={handleImport} className={btnPrimary}>
                  {busy ? "Importing..." : `Import ${parsed.transactions.length} transactions`}
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
