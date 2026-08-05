"use client";

import { Trash2 } from "lucide-react";
import { updateRunStatus, deleteRun, deleteRunStop } from "../actions";

const statuses = ["planned", "in_progress", "completed"] as const;

export function RunStatusActions({ runId, status }: { runId: string; status: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {statuses.map((s) => (
        <button
          key={s}
          onClick={() => updateRunStatus(runId, s)}
          className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
            status === s
              ? "bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900"
              : "border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          {s.replace("_", " ")}
        </button>
      ))}
      <button
        onClick={() => {
          if (confirm("Delete this stock sheet? This cannot be undone.")) deleteRun(runId);
        }}
        className="ml-auto flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
      >
        <Trash2 size={16} /> Delete stock sheet
      </button>
    </div>
  );
}

export function RemoveStopButton({ runId, stopId }: { runId: string; stopId: string }) {
  return (
    <button
      onClick={() => deleteRunStop(runId, stopId)}
      className="text-slate-400 hover:text-red-600"
      aria-label="Remove stop"
    >
      <Trash2 size={16} />
    </button>
  );
}
