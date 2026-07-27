"use client";

import { useActionState } from "react";
import { updateItem, deleteItem, type ItemFormState } from "../actions";
import type { Tables } from "@/lib/supabase/types";

const initialState: ItemFormState = { error: null };

export function EditItemForm({ item }: { item: Tables<"items"> }) {
  const updateWithId = updateItem.bind(null, item.id);
  const [state, formAction, pending] = useActionState(updateWithId, initialState);

  return (
    <form action={formAction} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Item code</label>
        <input disabled value={item.item_code ?? ""} className="mt-1 w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
        <input name="name" required defaultValue={item.name} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Category</label>
        <input name="category" defaultValue={item.category ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Sale price</label>
          <input name="sale_price" type="number" step="0.01" min="0" defaultValue={item.sale_price} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Stock qty</label>
          <input name="stock_qty" type="number" step="0.01" min="0" defaultValue={item.stock_qty} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Unit</label>
          <input name="unit" defaultValue={item.unit} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
        <textarea name="description" rows={2} defaultValue={item.description ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50" />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input type="checkbox" name="is_active" defaultChecked={item.is_active} className="rounded border-slate-300" />
        Active (shown when building invoices/purchases)
      </label>
      {state.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p> : null}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-50 dark:text-slate-900">
          {pending ? "Saving..." : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Delete ${item.name}? This cannot be undone.`)) {
              deleteItem(item.id);
            }
          }}
          className="rounded-md px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
        >
          Delete
        </button>
      </div>
    </form>
  );
}
