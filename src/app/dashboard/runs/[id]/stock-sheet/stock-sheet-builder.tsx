"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Printer } from "lucide-react";
import type { ItemOption } from "@/lib/supabase/items";
import { formatGBP } from "@/lib/format";
import { PdfShareActions } from "@/components/pdf-share-actions";

type Vendor = { id: string; name: string };

export type CustomerStopData = {
  stopId: string;
  customerName: string;
  items: { item_id: string | null; description: string; qty: number; unit: string }[];
};

type AggregatedItem = {
  key: string;
  itemId: string | null;
  name: string;
  unit: string;
  neededQty: number;
  unitCost: number;
};

type AllocationRow = { key: string; itemKey: string; vendorId: string; qty: number };

export function StockSheetBuilder({
  orgName,
  runDate,
  customerStops,
  vendors,
  items,
}: {
  orgName: string;
  runDate: string;
  customerStops: CustomerStopData[];
  vendors: Vendor[];
  items: ItemOption[];
}) {
  const [includedStops, setIncludedStops] = useState<Set<string>>(
    () => new Set(customerStops.map((s) => s.stopId))
  );
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [listName, setListName] = useState("");

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const vendorsById = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);

  const aggregated = useMemo<AggregatedItem[]>(() => {
    const map = new Map<string, AggregatedItem>();
    for (const stop of customerStops) {
      if (!includedStops.has(stop.stopId)) continue;
      for (const li of stop.items) {
        const key = li.item_id ?? `desc:${li.description}`;
        const catalogItem = li.item_id ? itemsById.get(li.item_id) : undefined;
        const existing = map.get(key);
        if (existing) {
          existing.neededQty += li.qty;
        } else {
          map.set(key, {
            key,
            itemId: li.item_id,
            name: catalogItem?.name ?? li.description,
            unit: li.unit || catalogItem?.unit || "unit",
            neededQty: li.qty,
            unitCost: catalogItem?.default_cost ?? 0,
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [customerStops, includedStops, itemsById]);

  const toggleStop = (stopId: string) => {
    setIncludedStops((prev) => {
      const next = new Set(prev);
      if (next.has(stopId)) next.delete(stopId);
      else next.add(stopId);
      return next;
    });
  };

  const addAllocation = (itemKey: string) => {
    setAllocations((prev) => [
      ...prev,
      { key: crypto.randomUUID(), itemKey, vendorId: vendors[0]?.id ?? "", qty: 0 },
    ]);
  };
  const updateAllocation = (key: string, patch: Partial<AllocationRow>) => {
    setAllocations((prev) => prev.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  };
  const removeAllocation = (key: string) => {
    setAllocations((prev) => prev.filter((a) => a.key !== key));
  };

  // Drop allocations for items that dropped out of the aggregation (e.g. a stop got unchecked).
  const aggregatedKeys = useMemo(() => new Set(aggregated.map((a) => a.key)), [aggregated]);
  const visibleAllocations = allocations.filter((a) => aggregatedKeys.has(a.itemKey));

  const allocatedByItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of visibleAllocations) {
      map.set(a.itemKey, (map.get(a.itemKey) ?? 0) + a.qty);
    }
    return map;
  }, [visibleAllocations]);

  // Group allocations by vendor for the printable/PDF sheet.
  const byVendor = useMemo(() => {
    const map = new Map<string, { vendorName: string; rows: { name: string; unit: string; qty: number; unitCost: number }[] }>();
    for (const a of visibleAllocations) {
      if (!a.vendorId || a.qty <= 0) continue;
      const item = aggregated.find((i) => i.key === a.itemKey);
      if (!item) continue;
      const vendor = vendorsById.get(a.vendorId);
      const vendorName = vendor?.name ?? "Unassigned";
      const row = { name: item.name, unit: item.unit, qty: a.qty, unitCost: item.unitCost };
      const existing = map.get(a.vendorId);
      if (existing) existing.rows.push(row);
      else map.set(a.vendorId, { vendorName, rows: [row] });
    }
    return Array.from(map.values());
  }, [visibleAllocations, aggregated, vendorsById]);

  const grandTotal = byVendor.reduce((sum, v) => sum + v.rows.reduce((s, r) => s + r.qty * r.unitCost, 0), 0);

  const sheetTitle = listName.trim() ? `${runDate} — ${listName.trim()}` : runDate;
  const printId = "stock-sheet-print";

  return (
    <div className="mt-6 space-y-6">
      {customerStops.length > 1 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            Customers included in this list
          </p>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Uncheck customers to build a separate list — e.g. one for London deliveries, another for outside London —
            from the same day&apos;s orders.
          </p>
          <div className="flex flex-wrap gap-3">
            {customerStops.map((stop) => (
              <label key={stop.stopId} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={includedStops.has(stop.stopId)}
                  onChange={() => toggleStop(stop.stopId)}
                  className="rounded border-slate-300"
                />
                {stop.customerName}
              </label>
            ))}
          </div>
          <div className="mt-3">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              List name (optional, shown on the PDF — e.g. &quot;London&quot;)
            </label>
            <input
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder="e.g. London"
              className="mt-1 w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
            />
          </div>
        </div>
      ) : null}

      <div>
        <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
          Total needed &amp; allocate to suppliers
        </h2>
        {!aggregated.length ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-400 dark:border-slate-700">
            No items found — add items to a customer checklist on this stock sheet first.
          </p>
        ) : (
          <div className="space-y-3">
            {aggregated.map((item) => {
              const allocated = allocatedByItem.get(item.key) ?? 0;
              const remaining = item.neededQty - allocated;
              const rows = visibleAllocations.filter((a) => a.itemKey === item.key);
              return (
                <div key={item.key} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-900 dark:text-slate-50">
                      {item.name} <span className="text-slate-400">({item.unit})</span>
                    </p>
                    <p
                      className={`text-sm font-medium ${
                        remaining > 0
                          ? "text-amber-600 dark:text-amber-400"
                          : remaining < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-green-600 dark:text-green-400"
                      }`}
                    >
                      Needed: {item.neededQty} · Allocated: {allocated}
                      {remaining !== 0 ? ` · ${remaining > 0 ? "Short" : "Over"} ${Math.abs(remaining)}` : " · Complete"}
                    </p>
                  </div>

                  <div className="mt-2 space-y-2">
                    {rows.map((row) => (
                      <div key={row.key} className="flex items-center gap-2">
                        <select
                          value={row.vendorId}
                          onChange={(e) => updateAllocation(row.key, { vendorId: e.target.value })}
                          className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                        >
                          <option value="">Select a supplier...</option>
                          {vendors.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.qty}
                          onChange={(e) => updateAllocation(row.key, { qty: Number(e.target.value) || 0 })}
                          className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                        />
                        <button type="button" onClick={() => removeAllocation(row.key)} className="text-slate-400 hover:text-red-600">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addAllocation(item.key)}
                      className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-50"
                    >
                      <Plus size={14} /> Add supplier
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {byVendor.length ? (
        <div>
          <div className="no-print flex flex-wrap items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Printer size={16} /> Print
            </button>
            <PdfShareActions
              targetId={printId}
              filename={`stock-sheet-${runDate}${listName.trim() ? `-${listName.trim().replace(/\s+/g, "-").toLowerCase()}` : ""}.pdf`}
              title={`Stock sheet — ${sheetTitle}`}
            />
          </div>

          <div id={printId} className="mt-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">{orgName}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Stock sheet — {sheetTitle}</p>

            {byVendor.map((v) => {
              const vendorTotal = v.rows.reduce((s, r) => s + r.qty * r.unitCost, 0);
              return (
                <div key={v.vendorName} className="mt-6">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-50">{v.vendorName}</h3>
                  <table className="mt-2 w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      <tr>
                        <th className="py-1.5 font-medium">Item</th>
                        <th className="py-1.5 text-right font-medium">Qty</th>
                        <th className="py-1.5 font-medium">Unit</th>
                        <th className="py-1.5 text-right font-medium">Unit price</th>
                        <th className="py-1.5 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {v.rows.map((r, i) => (
                        <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-1.5">{r.name}</td>
                          <td className="py-1.5 text-right">{r.qty}</td>
                          <td className="py-1.5">{r.unit}</td>
                          <td className="py-1.5 text-right">{formatGBP(r.unitCost)}</td>
                          <td className="py-1.5 text-right">{formatGBP(r.qty * r.unitCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-1 text-right text-sm font-medium text-slate-900 dark:text-slate-50">
                    Supplier total: {formatGBP(vendorTotal)}
                  </p>
                </div>
              );
            })}

            <p className="mt-6 border-t border-slate-200 pt-2 text-right font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
              Grand total: {formatGBP(grandTotal)}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
