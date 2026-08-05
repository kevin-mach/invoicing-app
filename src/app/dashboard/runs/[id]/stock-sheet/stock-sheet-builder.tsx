"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Printer } from "lucide-react";
import type { ItemOption } from "@/lib/supabase/items";
import { PdfShareActions } from "@/components/pdf-share-actions";

type Vendor = { id: string; name: string };

const NO_ZONE = "";

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
  neededByZone: Map<string, number>;
  totalNeeded: number;
};

type AllocationRow = { key: string; itemKey: string; zone: string; vendorId: string; qty: number };

export function StockSheetBuilder({
  runDate,
  customerStops,
  vendors,
  items,
}: {
  runDate: string;
  customerStops: CustomerStopData[];
  vendors: Vendor[];
  items: ItemOption[];
}) {
  // Optional per-customer zone/account tag (e.g. "London" / "Outside London") so one supplier's
  // order can be split into separate lists for separate invoices, while staying on one PDF.
  const [zoneByStop, setZoneByStop] = useState<Record<string, string>>({});
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const vendorsById = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);

  const aggregated = useMemo<AggregatedItem[]>(() => {
    const map = new Map<string, AggregatedItem>();
    for (const stop of customerStops) {
      const zone = (zoneByStop[stop.stopId] ?? "").trim();
      for (const li of stop.items) {
        const key = li.item_id ?? `desc:${li.description}`;
        const catalogItem = li.item_id ? itemsById.get(li.item_id) : undefined;
        const existing = map.get(key);
        if (existing) {
          existing.neededByZone.set(zone, (existing.neededByZone.get(zone) ?? 0) + li.qty);
          existing.totalNeeded += li.qty;
        } else {
          map.set(key, {
            key,
            itemId: li.item_id,
            name: catalogItem?.name ?? li.description,
            unit: li.unit || catalogItem?.unit || "unit",
            neededByZone: new Map([[zone, li.qty]]),
            totalNeeded: li.qty,
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [customerStops, zoneByStop, itemsById]);

  const setStopZone = (stopId: string, zone: string) => {
    setZoneByStop((prev) => ({ ...prev, [stopId]: zone }));
  };

  const addAllocation = (itemKey: string, zone: string) => {
    setAllocations((prev) => [
      ...prev,
      { key: crypto.randomUUID(), itemKey, zone, vendorId: vendors[0]?.id ?? "", qty: 0 },
    ]);
  };
  const updateAllocation = (key: string, patch: Partial<AllocationRow>) => {
    setAllocations((prev) => prev.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  };
  const removeAllocation = (key: string) => {
    setAllocations((prev) => prev.filter((a) => a.key !== key));
  };

  // Drop allocations for items that dropped out of the aggregation entirely.
  const aggregatedByKey = useMemo(() => new Map(aggregated.map((a) => [a.key, a])), [aggregated]);
  const visibleAllocations = allocations.filter((a) => aggregatedByKey.has(a.itemKey));

  const allocatedByItemZone = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of visibleAllocations) {
      const k = `${a.itemKey}::${a.zone}`;
      map.set(k, (map.get(k) ?? 0) + a.qty);
    }
    return map;
  }, [visibleAllocations]);

  // Group allocations by supplier, then by zone within that supplier, for the printable/PDF sheet.
  const byVendor = useMemo(() => {
    const map = new Map<
      string,
      { vendorName: string; byZone: Map<string, { name: string; unit: string; qty: number }[]> }
    >();
    for (const a of visibleAllocations) {
      if (!a.vendorId || a.qty <= 0) continue;
      const item = aggregatedByKey.get(a.itemKey);
      if (!item) continue;
      const vendor = vendorsById.get(a.vendorId);
      const vendorName = vendor?.name ?? "Unassigned";
      const row = { name: item.name, unit: item.unit, qty: a.qty };

      const existing = map.get(a.vendorId) ?? { vendorName, byZone: new Map() };
      const zoneRows = existing.byZone.get(a.zone) ?? [];
      zoneRows.push(row);
      existing.byZone.set(a.zone, zoneRows);
      map.set(a.vendorId, existing);
    }
    return Array.from(map.values());
  }, [visibleAllocations, aggregatedByKey, vendorsById]);

  const printId = "stock-sheet-print";

  return (
    <div className="mt-6 space-y-6">
      {customerStops.length > 1 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Zone / account per customer</p>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Optional — tag each customer (e.g. &quot;London&quot; / &quot;Outside London&quot;) so that if a supplier
            ends up covering customers in more than one zone, their part of the sheet is split into separate lists —
            handy when you want the supplier to invoice each zone separately. Leave blank if you don&apos;t need this.
          </p>
          <div className="space-y-2">
            {customerStops.map((stop) => (
              <div key={stop.stopId} className="flex items-center gap-2">
                <span className="w-40 shrink-0 text-sm text-slate-700 dark:text-slate-300">{stop.customerName}</span>
                <input
                  value={zoneByStop[stop.stopId] ?? ""}
                  onChange={(e) => setStopZone(stop.stopId, e.target.value)}
                  placeholder="e.g. London"
                  className="w-full max-w-xs rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                />
              </div>
            ))}
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
              const zones = Array.from(item.neededByZone.keys());
              const rows = visibleAllocations.filter((a) => a.itemKey === item.key);
              return (
                <div key={item.key} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <p className="font-medium text-slate-900 dark:text-slate-50">
                    {item.name} <span className="text-slate-400">({item.unit})</span>
                  </p>
                  <div className="mt-1 flex flex-wrap gap-3">
                    {zones.map((zone) => {
                      const needed = item.neededByZone.get(zone) ?? 0;
                      const allocated = allocatedByItemZone.get(`${item.key}::${zone}`) ?? 0;
                      const remaining = needed - allocated;
                      return (
                        <p
                          key={zone || NO_ZONE}
                          className={`text-sm font-medium ${
                            remaining > 0
                              ? "text-amber-600 dark:text-amber-400"
                              : remaining < 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-green-600 dark:text-green-400"
                          }`}
                        >
                          {zone ? `${zone}: ` : ""}Needed {needed} · Allocated {allocated}
                          {remaining !== 0 ? ` · ${remaining > 0 ? "Short" : "Over"} ${Math.abs(remaining)}` : " · Complete"}
                        </p>
                      );
                    })}
                  </div>

                  <div className="mt-2 space-y-2">
                    {rows.map((row) => (
                      <div key={row.key} className="flex items-center gap-2">
                        {zones.length > 1 ? (
                          <select
                            value={row.zone}
                            onChange={(e) => updateAllocation(row.key, { zone: e.target.value })}
                            className="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                          >
                            {zones.map((z) => (
                              <option key={z || NO_ZONE} value={z}>
                                {z || "No zone"}
                              </option>
                            ))}
                          </select>
                        ) : null}
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
                      onClick={() => addAllocation(item.key, zones[0] ?? NO_ZONE)}
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
            <PdfShareActions targetId={printId} filename={`stock-sheet-${runDate}.pdf`} title={`Stock sheet — ${runDate}`} />
          </div>

          <div id={printId} className="mt-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-900 dark:text-slate-50">{runDate}</p>

            <div className="mt-4 break-inside-avoid">
              <p className="font-bold text-slate-900 underline dark:text-slate-50">Item totals</p>
              {aggregated.map((item) => (
                <p key={item.key} className="text-sm text-slate-800 dark:text-slate-200">
                  {item.totalNeeded} {item.unit} {item.name}
                </p>
              ))}
            </div>

            <div className="mt-6 columns-1 gap-8 sm:columns-2 lg:columns-3">
              {byVendor.map((v) => {
                const zoneEntries = Array.from(v.byZone.entries());
                const multiZone = zoneEntries.length > 1;
                return (
                  <div key={v.vendorName} className="mb-6 break-inside-avoid">
                    <p className="font-bold text-slate-900 dark:text-slate-50">{v.vendorName}</p>
                    {zoneEntries.map(([zone, rows]) => (
                      <div key={zone || NO_ZONE} className={multiZone ? "mt-1" : ""}>
                        {multiZone && zone ? (
                          <p className="font-bold text-slate-900 underline dark:text-slate-50">{zone}</p>
                        ) : null}
                        {rows.map((r, i) => (
                          <p key={i} className="text-sm text-slate-800 dark:text-slate-200">
                            {r.qty} {r.unit} {r.name}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
