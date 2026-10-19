"use client";

import { Printer } from "lucide-react";
import { PdfShareActions } from "@/components/pdf-share-actions";

export function DailyReportActions({
  reportDate,
  targetId = "daily-invoice-report",
  title,
}: {
  /** Used in the file name (a date, or "from_to_to" for a range). */
  reportDate: string;
  targetId?: string;
  title?: string;
}) {
  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <button
        onClick={() => window.print()}
        className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Printer size={16} /> Print
      </button>
      <PdfShareActions
        targetId={targetId}
        filename={`report-${reportDate}.pdf`}
        title={title ?? `Daily report — ${reportDate}`}
      />
    </div>
  );
}
