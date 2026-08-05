"use client";

import { useState } from "react";
import { addRunStop } from "../actions";

type Entity = { id: string; name: string };

export function AddStopForm({
  runId,
  vendors,
  customers,
}: {
  runId: string;
  vendors: Entity[];
  customers: Entity[];
}) {
  const [stopType, setStopType] = useState<"vendor" | "customer">("vendor");
  const addStop = addRunStop.bind(null, runId);
  const options = stopType === "vendor" ? vendors : customers;

  return (
    <form action={addStop} className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Stop type</label>
        <select
          value={stopType}
          onChange={(e) => setStopType(e.target.value as "vendor" | "customer")}
          className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
        >
          <option value="vendor">Supplier (pick up)</option>
          <option value="customer">Customer (deliver)</option>
        </select>
      </div>
      <input type="hidden" name="stop_type" value={stopType} />
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {stopType === "vendor" ? "Supplier" : "Customer"}
        </label>
        <select
          name="entity_id"
          required
          className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
        >
          <option value="">Select...</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-50 dark:text-slate-900">
        Add stop
      </button>
    </form>
  );
}
