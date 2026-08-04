"use client";

import { useActionState } from "react";
import { createItem, type ItemFormState } from "../actions";
import { UnitField } from "@/components/unit-field";
import { CategoryField } from "@/components/category-field";

const initialState: ItemFormState = { error: null };

export function NewItemForm({ categories }: { categories: string[] }) {
  const [state, formAction, pending] = useActionState(createItem, initialState);

  return (
    <form action={formAction} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
        <input name="name" required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50" />
      </div>
      <CategoryField categories={categories} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Sale price</label>
          <input name="sale_price" type="number" step="0.01" min="0" defaultValue={0} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">VAT rate (%)</label>
          <input name="vat_rate" type="number" step="0.01" min="0" defaultValue={20} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Stock qty</label>
          <input name="stock_qty" type="number" step="0.01" min="0" defaultValue={0} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50" />
        </div>
        <UnitField defaultValue="unit" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
        <textarea name="description" rows={2} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50" />
      </div>
      {state.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-50 dark:text-slate-900">
        {pending ? "Saving..." : "Save item"}
      </button>
    </form>
  );
}
