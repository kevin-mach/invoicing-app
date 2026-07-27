"use client";

import { Trash2 } from "lucide-react";
import { updatePurchaseStatus, deletePurchase } from "../actions";

const statuses = ["recorded", "reviewed"] as const;

export function PurchaseActions({ purchaseId, status }: { purchaseId: string; status: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {statuses.map((s) => (
        <button
          key={s}
          onClick={() => updatePurchaseStatus(purchaseId, s)}
          className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
            status === s
              ? "bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900"
              : "border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          {s}
        </button>
      ))}
      <button
        onClick={() => {
          if (confirm("Delete this purchase? This cannot be undone.")) deletePurchase(purchaseId);
        }}
        className="ml-auto flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
      >
        <Trash2 size={16} /> Delete
      </button>
    </div>
  );
}
