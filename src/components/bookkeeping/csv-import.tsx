"use client";

import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Upload } from "lucide-react";
import { parseSpreadsheetFile } from "@/lib/csv/parse";
import { btnPrimary, btnSecondary, FormNote, type FormStatus } from "./ui";

/** Generic "upload a spreadsheet, map its columns, preview, import" panel — the shape shared by
 * every simple CSV importer in the bookkeeping module (payroll, POS; bank keeps its own, since it
 * also needs a sign-flip toggle and a line-by-line preview table). `C` is the caller's column-map
 * type (e.g. `PayrollColumns`), `R` the parsed row/item type, `Res` the import action's result. */
export function CsvImportPanel<C extends Record<string, string | undefined>, R, Res extends { error: string | null }>({
  title,
  description,
  accept = ".csv,.xlsx,.xls",
  fields,
  detectColumns,
  parse,
  onImport,
  renderSummary,
  successText,
  importLabel,
}: {
  title: string;
  description: string;
  accept?: string;
  fields: { key: keyof C; label: string }[];
  detectColumns: (headers: string[]) => C;
  parse: (rows: Record<string, string>[], cols: C) => { items: R[]; skipped: number };
  onImport: (items: R[]) => Promise<Res>;
  /** The area between the column mapping and the Import button — a summary line, totals, warnings. */
  renderSummary?: (parsed: { items: R[]; skipped: number }, cols: C, rows: Record<string, string>[]) => ReactNode;
  successText: (result: Res, items: R[]) => string;
  importLabel?: (count: number) => string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [cols, setCols] = useState<C | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<FormStatus>(null);

  const headers = useMemo(() => (rows.length ? Object.keys(rows[0]) : []), [rows]);
  const parsed = useMemo(() => (cols ? parse(rows, cols) : { items: [] as R[], skipped: 0 }), [rows, cols, parse]);

  const onFile = async (file: File) => {
    setNote(null);
    try {
      const parsedRows = await parseSpreadsheetFile(file);
      if (!parsedRows.length) {
        setNote({ ok: false, text: "That file has no rows." });
        return;
      }
      setRows(parsedRows);
      setCols(detectColumns(Object.keys(parsedRows[0])));
    } catch {
      setNote({ ok: false, text: "Couldn't read that file. Use .csv or .xlsx." });
    }
  };

  const doImport = async () => {
    setBusy(true);
    const result = await onImport(parsed.items);
    setBusy(false);
    if (result.error) {
      setNote({ ok: false, text: result.error });
      return;
    }
    setNote({ ok: true, text: successText(result, parsed.items) });
    setRows([]);
    setCols(null);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFile(file);
          e.target.value = "";
        }}
      />
      <button type="button" onClick={() => inputRef.current?.click()} className={`mt-3 inline-flex items-center gap-2 ${btnSecondary}`}>
        <Upload size={16} /> Choose file
      </button>

      {rows.length && cols ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {fields.map((f) => (
              <div key={String(f.key)}>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">{f.label}</label>
                <select
                  value={(cols[f.key] as string | undefined) ?? ""}
                  onChange={(e) => setCols((c) => (c ? { ...c, [f.key]: e.target.value || undefined } : c))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
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

          {renderSummary ? renderSummary(parsed, cols, rows) : null}

          <div className="flex gap-3">
            <button type="button" disabled={busy || !parsed.items.length} onClick={doImport} className={btnPrimary}>
              {busy ? "Importing..." : (importLabel ? importLabel(parsed.items.length) : "Import")}
            </button>
            <button
              type="button"
              onClick={() => {
                setRows([]);
                setCols(null);
              }}
              className="text-sm text-slate-500 hover:underline"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <FormNote note={note} />
    </div>
  );
}
