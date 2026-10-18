"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { btnPrimary, btnSecondary } from "@/components/bookkeeping/ui";

export type ExportSheet = { name: string; rows: (string | number)[][] };

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportButtons({ sheets, filename }: { sheets: ExportSheet[]; filename: string }) {
  const [busy, setBusy] = useState(false);

  const workbook = async () => {
    setBusy(true);
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    for (const s of sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.rows), s.name.slice(0, 31));
    XLSX.writeFile(wb, `${filename}.xlsx`);
    setBusy(false);
  };

  const csv = async (sheet: ExportSheet) => {
    const XLSX = await import("xlsx");
    const text = XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(sheet.rows));
    download(new Blob([text], { type: "text/csv;charset=utf-8" }), `${filename}-${sheet.name.toLowerCase().replace(/\s+/g, "-")}.csv`);
  };

  return (
    <div className="space-y-4">
      <button type="button" onClick={workbook} disabled={busy} className={`flex items-center gap-2 ${btnPrimary}`}>
        <FileSpreadsheet size={16} /> {busy ? "Building..." : "Download accountant pack (.xlsx)"}
      </button>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {sheets.map((s) => (
            <li key={s.name} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-50">{s.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{Math.max(0, s.rows.length - 1)} rows</p>
              </div>
              <button type="button" onClick={() => csv(s)} className={`${btnSecondary} text-xs`}>
                CSV
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
