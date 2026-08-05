"use client";

import { Printer, Trash2 } from "lucide-react";
import { deleteQuote } from "../actions";

export function QuoteActions({ quoteId }: { quoteId: string }) {
  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <button
        onClick={() => window.print()}
        className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Printer size={16} /> Print
      </button>
      <button
        onClick={() => {
          if (confirm("Delete this quote? This cannot be undone.")) deleteQuote(quoteId);
        }}
        className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
      >
        <Trash2 size={16} /> Delete
      </button>
    </div>
  );
}
