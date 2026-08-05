"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { TemplateFormState, TemplateLineItemInput } from "@/app/dashboard/templates/actions";
import type { ItemOption } from "@/lib/supabase/items";
import { DateInput } from "@/components/date-input";

type Customer = { id: string; name: string };
type Row = TemplateLineItemInput & { key: string };

const emptyRow = (): Row => ({ key: crypto.randomUUID(), item_id: null, description: "", qty: 1, unit_cost: 0, unit_price: 0 });

export function TemplateForm({
  action,
  customers,
  items,
  initialCustomerId,
  initialCadence,
  initialNextRunDate,
  initialLineItems,
  submitLabel = "Save template",
}: {
  action: (state: TemplateFormState, formData: FormData) => Promise<TemplateFormState>;
  customers: Customer[];
  items: ItemOption[];
  initialCustomerId?: string;
  initialCadence?: string;
  initialNextRunDate?: string;
  initialLineItems?: TemplateLineItemInput[];
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null } as TemplateFormState);
  const [rows, setRows] = useState<Row[]>(
    initialLineItems?.length ? initialLineItems.map((li) => ({ ...li, key: crypto.randomUUID() })) : [emptyRow()]
  );
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const updateRow = (key: string, patch: Partial<Row>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key: string) => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  return (
    <form action={formAction} className="mt-6 space-y-6">
      <input type="hidden" name="line_items" value={JSON.stringify(rows.map(({ key: _key, ...rest }) => rest))} />

      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Customer</label>
          <select
            name="customer_id"
            required
            defaultValue={initialCustomerId ?? ""}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          >
            <option value="">Select a customer...</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Cadence</label>
          <select
            name="cadence"
            defaultValue={initialCadence ?? "monthly"}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Next run date</label>
          <DateInput
            name="next_run_date"
            required
            defaultValue={initialNextRunDate ?? ""}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="w-20 px-3 py-2 text-right font-medium">Qty</th>
              <th className="w-24 px-3 py-2 text-right font-medium">Cost</th>
              <th className="w-24 px-3 py-2 text-right font-medium">Price</th>
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="px-3 py-2">
                  <select
                    value={row.item_id ?? ""}
                    onChange={(e) => {
                      const item = itemsById.get(e.target.value);
                      if (item) {
                        updateRow(row.key, { item_id: item.id, description: item.name, unit_price: item.sale_price, unit_cost: item.default_cost });
                      } else {
                        updateRow(row.key, { item_id: null });
                      }
                    }}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                  >
                    <option value="">Custom</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.item_code} - {i.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    value={row.description}
                    onChange={(e) => updateRow(row.key, { description: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.qty}
                    onChange={(e) => updateRow(row.key, { qty: Number(e.target.value) || 0 })}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.unit_cost}
                    onChange={(e) => updateRow(row.key, { unit_cost: Number(e.target.value) || 0 })}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.unit_price}
                    onChange={(e) => updateRow(row.key, { unit_price: Number(e.target.value) || 0 })}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <button type="button" onClick={() => removeRow(row.key)} className="text-slate-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1 border-t border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Plus size={16} /> Add line
        </button>
      </div>

      {state.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-50 dark:text-slate-900"
      >
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
