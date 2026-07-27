"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { PurchaseFormState, PurchaseLineItemInput } from "@/app/dashboard/purchases/actions";
import type { ItemOption } from "@/lib/supabase/items";
import { ReceiptScanner } from "@/components/receipt-scanner";
import type { ParsedReceiptLine } from "@/lib/ocr/parse-lines";

type Vendor = { id: string; name: string };
type Row = PurchaseLineItemInput & { key: string };

const emptyRow = (): Row => ({ key: crypto.randomUUID(), item_id: null, description: "", qty: 1, unit_cost: 0 });

export function PurchaseForm({
  action,
  orgId,
  vendors,
  items,
  initialVendorId,
  initialNotes,
  initialLineItems,
  submitLabel = "Save purchase",
}: {
  action: (state: PurchaseFormState, formData: FormData) => Promise<PurchaseFormState>;
  orgId: string;
  vendors: Vendor[];
  items: ItemOption[];
  initialVendorId?: string;
  initialNotes?: string;
  initialLineItems?: PurchaseLineItemInput[];
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null } as PurchaseFormState);
  const [vendorId, setVendorId] = useState(initialVendorId ?? "");
  const [rows, setRows] = useState<Row[]>(
    initialLineItems?.length ? initialLineItems.map((li) => ({ ...li, key: crypto.randomUUID() })) : [emptyRow()]
  );
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const updateRow = (key: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };
  const removeRow = (key: string) => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const handleScanned = (parsed: ParsedReceiptLine[], url: string) => {
    setImageUrl(url);
    if (!parsed.length) return;
    setRows((prev) => {
      const blank = prev.filter((r) => r.description.trim() || r.item_id);
      const scanned = parsed.map((p) => ({
        key: crypto.randomUUID(),
        item_id: null,
        description: p.description,
        qty: p.qty,
        unit_cost: p.unit_cost,
      }));
      return blank.length ? [...blank, ...scanned] : scanned;
    });
  };

  const total = rows.reduce((sum, r) => sum + r.qty * r.unit_cost, 0);

  return (
    <form action={formAction} className="mt-6 space-y-6">
      <input type="hidden" name="line_items" value={JSON.stringify(rows.map(({ key: _key, ...rest }) => rest))} />
      <input type="hidden" name="image_url" value={imageUrl ?? ""} />

      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Vendor</label>
          <select
            name="vendor_id"
            required
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          >
            <option value="">Select a vendor...</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <ReceiptScanner orgId={orgId} onScanned={handleScanned} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Notes</label>
          <textarea
            name="notes"
            rows={2}
            defaultValue={initialNotes ?? ""}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="w-20 px-3 py-2 text-right font-medium">Qty</th>
              <th className="w-24 px-3 py-2 text-right font-medium">Cost</th>
              <th className="w-24 px-3 py-2 text-right font-medium">Line total</th>
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
                        updateRow(row.key, { item_id: item.id, description: item.name, unit_cost: item.default_cost || row.unit_cost });
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
                <td className="px-3 py-2 text-right text-slate-900 dark:text-slate-50">
                  ${(row.qty * row.unit_cost).toFixed(2)}
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

      <div className="flex justify-end">
        <div className="w-full max-w-xs rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex justify-between font-semibold text-slate-900 dark:text-slate-50">
            <span>Total cost</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
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
