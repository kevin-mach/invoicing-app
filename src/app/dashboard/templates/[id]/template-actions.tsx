"use client";

import { Trash2 } from "lucide-react";
import { toggleTemplateActive, deleteTemplate } from "../actions";

export function TemplateActions({ templateId, active }: { templateId: string; active: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => toggleTemplateActive(templateId, !active)}
        className={`rounded-full px-3 py-1 text-xs font-medium ${
          active
            ? "bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900"
            : "border border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"
        }`}
      >
        {active ? "Active" : "Paused"}
      </button>
      <button
        onClick={() => {
          if (confirm("Delete this template? This cannot be undone.")) deleteTemplate(templateId);
        }}
        className="ml-auto flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
      >
        <Trash2 size={16} /> Delete
      </button>
    </div>
  );
}
