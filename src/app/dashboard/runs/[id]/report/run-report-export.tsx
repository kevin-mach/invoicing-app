"use client";

import { useState } from "react";
import { Printer, Sheet } from "lucide-react";
import { formatGBP } from "@/lib/format";
import { PdfShareActions } from "@/components/pdf-share-actions";

export type RunReportLine = {
  type: "purchase" | "invoice" | "cash";
  entity: string;
  description: string;
  qty: number;
  amount: number;
};

const typeLabel: Record<RunReportLine["type"], string> = {
  purchase: "Purchase (cost)",
  invoice: "Invoice (revenue)",
  cash: "Cash item",
};

export function RunReportExport({
  runDate,
  orgName,
  lines,
  totalCost,
  totalRevenue,
  totalCash,
}: {
  runDate: string;
  orgName: string;
  lines: RunReportLine[];
  totalCost: number;
  totalRevenue: number;
  totalCash: number;
}) {
  const [exporting, setExporting] = useState(false);

  const exportExcel = async () => {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const rows = [
        ["Run report", runDate, orgName],
        [],
        ["Type", "Entity", "Description", "Qty", "Amount"],
        ...lines.map((l) => [typeLabel[l.type], l.entity, l.description, l.qty, l.amount]),
        [],
        ["Total cost", "", "", "", totalCost],
        ["Total revenue", "", "", "", totalRevenue],
        ["Total cash items", "", "", "", totalCash],
        ["Profit (revenue - cost)", "", "", "", totalRevenue - totalCost],
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Run Report");
      XLSX.writeFile(workbook, `run-${runDate}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="no-print mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Printer size={16} /> Print
        </button>
        <PdfShareActions targetId="run-report" filename={`run-${runDate}.pdf`} title={`Run report — ${runDate}`} />
        <button
          onClick={exportExcel}
          disabled={exporting}
          className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Sheet size={16} /> {exporting ? "Exporting..." : "Export Excel"}
        </button>
      </div>

      <div id="run-report" className="mt-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">{orgName}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Run report — {runDate}</p>

        <table className="mt-4 w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="py-2 font-medium">Type</th>
              <th className="py-2 font-medium">Entity</th>
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 text-slate-600 dark:text-slate-400">{typeLabel[l.type]}</td>
                <td className="py-2">{l.entity}</td>
                <td className="py-2">{l.description}</td>
                <td className="py-2 text-right">{l.qty}</td>
                <td className="py-2 text-right">{formatGBP(l.amount)}</td>
              </tr>
            ))}
            {!lines.length ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400">
                  No purchases or invoices recorded for this run yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Total cost</span>
              <span>{formatGBP(totalCost)}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Total revenue</span>
              <span>{formatGBP(totalRevenue)}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Cash items</span>
              <span>{formatGBP(totalCash)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
              <span>Profit</span>
              <span>{formatGBP(totalRevenue - totalCost)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
