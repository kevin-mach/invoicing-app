"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { QuoteFormState, QuoteLineItemInput } from "@/app/dashboard/quotes/actions";
import type { ItemOption } from "@/lib/supabase/items";
import { formatGBP, roundQty } from "@/lib/format";
import { ScanButton } from "@/components/bookkeeping/scan-button";
import type { ScanExtraction } from "@/lib/scan/extract";
import { matchCatalogItem } from "@/lib/scan/match-items";
import { useNewEntriesPrompt, type ProposedEntry } from "@/components/bookkeeping/use-new-entries";

type Row = QuoteLineItemInput & { key: string };

const emptyRow = (): Row => ({
  key: crypto.randomUUID(),
  item_id: null,
  description: "",
  qty: 1,
  unit_price: 0,
});

export function QuoteForm({
  action,
  items: baseItems,
  initialRecipientName,
  initialRecipientContact,
  initialNotes,
  initialLineItems,
  submitLabel = "Save quote",
  autoSaveScans,
}: {
  action: (state: QuoteFormState, formData: FormData) => Promise<QuoteFormState>;
  items: ItemOption[];
  initialRecipientName?: string;
  initialRecipientContact?: string;
  initialNotes?: string;
  initialLineItems?: QuoteLineItemInput[];
  submitLabel?: string;
  /** Pass on the "new quote" page to switch photo scanning on; leave out when editing a saved quote. */
  autoSaveScans?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null } as QuoteFormState);
  const [rows, setRows] = useState<Row[]>(
    initialLineItems?.length
      ? initialLineItems.map((li) => ({ ...li, key: crypto.randomUUID() }))
      : [emptyRow()]
  );
  const [extraItems, setExtraItems] = useState<ItemOption[]>([]);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);
  const { ask, prompt } = useNewEntriesPrompt();

  const items = useMemo(() => [...baseItems, ...extraItems.filter((e) => !baseItems.some((i) => i.id === e.id))], [baseItems, extraItems]);
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const handleScanned = async (data: ScanExtraction) => {
    if (data.kind !== "list") return;
    setScanNote(null);
    let catalogList = items;

    const proposed = new Map<string, ProposedEntry>();
    for (const line of data.items) {
      if (matchCatalogItem(line.description, catalogList) || proposed.has(`i:${line.description}`)) continue;
      proposed.set(`i:${line.description}`, {
        key: `i:${line.description}`,
        kind: "Item",
        label: line.description,
        detail: `${line.qty}${line.unit ? ` ${line.unit}` : ""}`,
        item: { name: line.description, unit: line.unit ?? "unit" },
      });
    }
    let settled = true;
    let createdNew = false;
    if (proposed.size) {
      const created = await ask([...proposed.values()]);
      if (created) {
        catalogList = [...catalogList, ...created.items];
        setExtraItems((p) => [...p, ...created.items]);
        createdNew = created.items.length > 0;
      } else {
        settled = false;
      }
    }

    const added: Row[] = data.items.map((line) => {
      const item = matchCatalogItem(line.description, catalogList);
      return {
        key: crypto.randomUUID(),
        item_id: item?.id ?? null,
        description: item ? `${item.unit} of ${item.name}` : line.description,
        qty: line.qty,
        unit_price: item?.sale_price ?? 0,
      };
    });
    const nextRows = [...rowsRef.current.filter((r) => r.description.trim() || r.item_id), ...added];
    setRows(nextRows);

    const priced = added.length > 0 && added.every((r) => r.item_id && r.unit_price > 0);
    const fd = formRef.current ? new FormData(formRef.current) : null;
    const hasRecipient = !!String(fd?.get("recipient_name") ?? "").trim();
    if (!autoSaveScans) {
      setScanNote(`Added ${added.length} line${added.length === 1 ? "" : "s"} from the photo — check them and save.`);
      return;
    }
    if (!settled || !priced || !hasRecipient || !fd) {
      setScanNote(
        `Added ${added.length} line${added.length === 1 ? "" : "s"} from the photo but didn't save automatically: ${
          !hasRecipient ? "enter who the quote is for" : createdNew ? "new items start at £0, so set their prices" : !settled ? "some items were skipped" : "some lines have no price"
        }. Check it and press ${submitLabel}.`
      );
      return;
    }
    fd.set("line_items", JSON.stringify(nextRows.map(({ key: _key, ...rest }) => rest)));
    setAutoSaving(true);
    const result = await action({ error: null }, fd);
    setAutoSaving(false);
    if (result.error) setScanNote(`Couldn't auto-save — ${result.error} Check the quote and save manually.`);
  };

  const updateRow = (key: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };
  const removeRow = (key: string) => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const total = rows.reduce((sum, r) => sum + r.qty * r.unit_price, 0);

  return (
    <form ref={formRef} action={formAction} className="mt-6 space-y-6">
      <input type="hidden" name="line_items" value={JSON.stringify(rows.map(({ key: _key, ...rest }) => rest))} />

      {autoSaveScans !== undefined ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Scan a photo of an order, a price list or the goods to fill in the lines.
          </p>
          <ScanButton kind="list" label="Scan a photo" onExtracted={handleScanned} />
        </div>
      ) : null}
      {prompt}
      {scanNote ? <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-400">{scanNote}</p> : null}
      {autoSaving ? <p className="text-sm text-slate-500 dark:text-slate-400">Saving automatically from the photo...</p> : null}

      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Recipient name</label>
          <input
            name="recipient_name"
            required
            defaultValue={initialRecipientName ?? ""}
            placeholder="Prospective customer or business name"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Contact</label>
          <input
            name="recipient_contact"
            defaultValue={initialRecipientContact ?? ""}
            placeholder="Phone, email, or address"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          />
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
        <table className="lines w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="w-20 px-3 py-2 text-right font-medium">Qty</th>
              <th className="w-24 px-3 py-2 text-right font-medium">Price</th>
              <th className="w-24 px-3 py-2 text-right font-medium">Line total</th>
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="px-3 py-2" data-label="Item" data-wide>
                  <select
                    value={row.item_id ?? ""}
                    onChange={(e) => {
                      const item = itemsById.get(e.target.value);
                      if (item) {
                        updateRow(row.key, {
                          item_id: item.id,
                          description: `${item.unit} of ${item.name}`,
                          unit_price: item.sale_price,
                        });
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
                <td className="px-3 py-2" data-label="Description" data-wide>
                  <input
                    value={row.description}
                    onChange={(e) => updateRow(row.key, { description: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                  />
                </td>
                <td className="px-3 py-2" data-label="Qty">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.qty}
                    onChange={(e) => updateRow(row.key, { qty: roundQty(Number(e.target.value) || 0) })}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                  />
                </td>
                <td className="px-3 py-2" data-label="Price">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.unit_price}
                    onChange={(e) => updateRow(row.key, { unit_price: Number(e.target.value) || 0 })}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                  />
                </td>
                <td className="px-3 py-2 text-right text-slate-900 dark:text-slate-50" data-label="Line total">
                  {formatGBP(row.qty * row.unit_price)}
                </td>
                <td className="px-3 py-2 text-right" data-remove>
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
          <Plus size={16} /> Add item
        </button>
      </div>

      <div className="flex justify-end">
        <div className="w-full max-w-xs space-y-1 rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
            <span>Total</span>
            <span>{formatGBP(total)}</span>
          </div>
        </div>
      </div>

      {state.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending || autoSaving}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-50 dark:text-slate-900"
      >
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
