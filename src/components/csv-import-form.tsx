"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Download } from "lucide-react";
import { parseSpreadsheetFile, mapRows, buildTemplateCsv, type ImportField, type ImportResult } from "@/lib/csv/parse";

export function CsvImportForm({
  title,
  description,
  fields,
  templateFilename,
  action,
  listHref,
}: {
  title: string;
  description: string;
  fields: ImportField[];
  templateFilename: string;
  action: (rows: Record<string, string>[]) => Promise<ImportResult>;
  listHref: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [parseError, setParseError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setResult(null);
    setParseError(null);
    try {
      const raw = await parseSpreadsheetFile(file);
      const { rows: mapped, skippedCount } = mapRows(raw, fields);
      setRows(mapped);
      setSkippedCount(skippedCount);
      if (!mapped.length) {
        setParseError(
          "No usable rows found. Check that your file has a header row with recognizable column names."
        );
      }
    } catch {
      setParseError("Could not read that file. Make sure it's a .csv or .xlsx file.");
      setRows([]);
    }
  };

  const downloadTemplate = () => {
    const csv = buildTemplateCsv(fields);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = templateFilename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    startTransition(async () => {
      const res = await action(rows);
      setResult(res);
      if (!res.error) {
        router.push(listHref);
        router.refresh();
      }
    });
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{title}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <button
          onClick={downloadTemplate}
          type="button"
          className="flex shrink-0 items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Download size={16} /> Template
        </button>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Choose a .csv or .xlsx file
        </label>
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700 dark:text-slate-400 dark:file:bg-slate-50 dark:file:text-slate-900"
        />
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Expected columns: {fields.map((f) => `${f.label}${f.required ? " (required)" : ""}`).join(", ")}
        </p>

        {parseError ? (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {parseError}
          </p>
        ) : null}

        {fileName && !parseError ? (
          <div className="mt-4">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              <span className="font-medium">{rows.length}</span> row{rows.length === 1 ? "" : "s"} ready to import
              from <span className="font-medium">{fileName}</span>
              {skippedCount
                ? ` — ${skippedCount} row${skippedCount === 1 ? "" : "s"} skipped (missing a required field)`
                : ""}
            </p>

            {rows.length ? (
              <div className="mt-3 overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <tr>
                      {fields.map((f) => (
                        <th key={f.key} className="whitespace-nowrap px-2 py-1.5 font-medium">
                          {f.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                        {fields.map((f) => (
                          <td key={f.key} className="whitespace-nowrap px-2 py-1.5 text-slate-700 dark:text-slate-300">
                            {row[f.key] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 5 ? (
                  <p className="border-t border-slate-200 px-2 py-1.5 text-slate-400 dark:border-slate-800">
                    + {rows.length - 5} more row{rows.length - 5 === 1 ? "" : "s"}
                  </p>
                ) : null}
              </div>
            ) : null}

            {result?.error ? (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                {result.error}
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleImport}
              disabled={!rows.length || pending}
              className="mt-4 flex items-center gap-1 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-50 dark:text-slate-900"
            >
              <Upload size={16} /> {pending ? "Importing..." : `Import ${rows.length} row${rows.length === 1 ? "" : "s"}`}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
