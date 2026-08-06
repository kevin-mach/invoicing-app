"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Plus, Search, ShoppingCart, FileText, Trash2 } from "lucide-react";
import type { ItemOption } from "@/lib/supabase/items";
import { UNIT_PRESETS } from "@/components/unit-field";
import {
  saveChecklistItems,
  togglePriceVisible,
  convertChecklistToPurchase,
  convertChecklistToInvoice,
  type ChecklistItemInput,
} from "./actions";

type Row = ChecklistItemInput & { key: string };

type Suggestion = { item_id: string; description: string; unit_price: number; count: number };

const emptyRow = (): Row => ({
  key: crypto.randomUUID(),
  item_id: null,
  description: "",
  qty: 1,
  category: "real",
  unit_price: 0,
  unit: "unit",
});

export function ChecklistEditor({
  checklistId,
  stopType,
  stopEntityId,
  items,
  initialItems,
  initialPriceVisible,
  initialLabel,
}: {
  checklistId: string;
  stopType: "vendor" | "customer";
  stopEntityId: string | null;
  items: ItemOption[];
  initialItems: ChecklistItemInput[];
  initialPriceVisible: boolean;
  initialLabel: string;
}) {
  const [rows, setRows] = useState<Row[]>(
    initialItems.length ? initialItems.map((i) => ({ ...i, key: crypto.randomUUID() })) : [emptyRow()]
  );
  const [priceVisible, setPriceVisible] = useState(initialPriceVisible);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [search, setSearch] = useState("");
  const saveWithId = saveChecklistItems.bind(null, checklistId);

  const updateRow = (key: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key: string) => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const itemsById = new Map(items.map((i) => [i.id, i]));

  const duplicateGroups = useMemo(() => {
    const groups = new Map<string, Row[]>();
    for (const row of rows) {
      if (!row.description.trim() && !row.item_id) continue;
      const key = row.item_id ?? `desc:${row.description.trim().toLowerCase()}`;
      const group = groups.get(key);
      if (group) group.push(row);
      else groups.set(key, [row]);
    }
    return Array.from(groups.values()).filter((group) => group.length > 1);
  }, [rows]);

  const mergeDuplicates = () => {
    setRows((prev) => {
      const seen = new Set<string>();
      const merged: Row[] = [];
      for (const row of prev) {
        const key = row.item_id ?? `desc:${row.description.trim().toLowerCase()}`;
        if (!row.description.trim() && !row.item_id) {
          merged.push(row);
          continue;
        }
        if (seen.has(key)) {
          const target = merged.find(
            (m) => (m.item_id ?? `desc:${m.description.trim().toLowerCase()}`) === key
          );
          if (target) target.qty += row.qty;
          continue;
        }
        seen.add(key);
        merged.push({ ...row });
      }
      return merged;
    });
  };

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return items
      .filter((i) => i.name.toLowerCase().includes(q) || i.item_code?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, items]);

  const addItem = (item: ItemOption) => {
    setRows((prev) => [
      ...prev.filter((r) => r.description.trim() || r.item_id),
      {
        key: crypto.randomUUID(),
        item_id: item.id,
        description: item.name,
        qty: 1,
        category: "real",
        unit_price: stopType === "customer" ? item.sale_price : item.default_cost,
        unit: item.unit,
      },
    ]);
    setSearch("");
  };

  useEffect(() => {
    if (!stopEntityId) return;
    let cancelled = false;
    const endpoint =
      stopType === "vendor"
        ? `/api/vendors/${stopEntityId}/suggested-items`
        : `/api/customers/${stopEntityId}/suggested-items`;
    fetch(endpoint)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSuggestions(data.suggestions ?? []);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [stopType, stopEntityId]);

  const addSuggestion = (s: Suggestion) => {
    const item = itemsById.get(s.item_id);
    setRows((prev) => [
      ...prev.filter((r) => r.description.trim() || r.item_id),
      {
        key: crypto.randomUUID(),
        item_id: s.item_id,
        description: item ? item.name : s.description,
        qty: 1,
        category: "real",
        unit_price: s.unit_price,
        unit: item?.unit ?? "unit",
      },
    ]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            setPriceVisible((v) => !v);
            togglePriceVisible(checklistId, !priceVisible);
          }}
          className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {priceVisible ? <Eye size={16} /> : <EyeOff size={16} />}
          {priceVisible ? "Prices shown" : "Prices hidden"}
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => convertChecklistToPurchase(checklistId, rows.map(({ key: _key, ...rest }) => rest))}
            disabled={stopType !== "vendor"}
            className="flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40 dark:bg-slate-50 dark:text-slate-900"
          >
            <ShoppingCart size={16} /> Create purchase
          </button>
          <button
            type="button"
            onClick={() => convertChecklistToInvoice(checklistId, rows.map(({ key: _key, ...rest }) => rest))}
            disabled={stopType !== "customer"}
            className="flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40 dark:bg-slate-50 dark:text-slate-900"
          >
            <FileText size={16} /> Create invoice
          </button>
        </div>
      </div>

      <div className="relative">
        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Search items to add
        </label>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type a name or code to quickly add an item..."
            className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          />
        </div>
        {searchResults.length ? (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            {searchResults.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => addItem(item)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <span className="text-slate-900 dark:text-slate-50">
                  {item.item_code ? `${item.item_code} - ` : ""}
                  {item.name}
                </span>
                <span className="text-xs text-slate-400">Add</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {suggestions.length ? (
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            {stopType === "vendor" ? "Frequently picked up from this supplier" : "Frequently delivered to this customer"}
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                type="button"
                key={s.item_id}
                onClick={() => addSuggestion(s)}
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                + {s.description}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {duplicateGroups.length ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <p>
            Duplicate item{duplicateGroups.length === 1 ? "" : "s"}:{" "}
            {duplicateGroups
              .map((group) => `${group[0].description || "Untitled item"} (×${group.length})`)
              .join(", ")}
            . If that&apos;s intentional, merge them into one line with the combined quantity.
          </p>
          <button
            type="button"
            onClick={mergeDuplicates}
            className="mt-2 rounded-md border border-amber-400 bg-white px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-amber-900"
          >
            Merge duplicates
          </button>
        </div>
      ) : null}

      <form action={saveWithId}>
        <input type="hidden" name="items" value={JSON.stringify(rows.map(({ key: _key, ...rest }) => rest))} />

        {stopType === "vendor" ? (
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              List name (optional)
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              If this supplier needs more than one separate list (e.g. London vs outside London deliveries), add
              another stop for the same supplier and give each checklist a different name here.
            </p>
            <input
              name="label"
              defaultValue={initialLabel}
              placeholder="e.g. London"
              className="mt-1 w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
            />
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="w-20 px-3 py-2 text-right font-medium">Qty</th>
                <th className="w-24 px-3 py-2 font-medium">Unit</th>
                <th className="w-28 px-3 py-2 font-medium">Category</th>
                {priceVisible ? <th className="w-24 px-3 py-2 text-right font-medium">Price</th> : null}
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
                          updateRow(row.key, {
                            item_id: item.id,
                            description: item.name,
                            unit_price: stopType === "customer" ? item.sale_price : item.default_cost,
                            unit: item.unit,
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
                    <select
                      value={row.unit}
                      onChange={(e) => updateRow(row.key, { unit: e.target.value })}
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                    >
                      {UNIT_PRESETS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {(["real", "cash"] as const).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => updateRow(row.key, { category: c })}
                          className={`rounded px-2 py-1 text-xs font-medium capitalize ${
                            row.category === c
                              ? "bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900"
                              : "border border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </td>
                  {priceVisible ? (
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
                  ) : null}
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
            <Plus size={16} /> Add item
          </button>
        </div>

        <button
          type="submit"
          className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-50 dark:text-slate-900"
        >
          Save checklist
        </button>
      </form>
    </div>
  );
}
