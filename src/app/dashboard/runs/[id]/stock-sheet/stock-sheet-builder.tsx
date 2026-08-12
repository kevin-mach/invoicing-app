"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Printer, Search, Sheet } from "lucide-react";
import type { ItemOption } from "@/lib/supabase/items";
import { PdfShareActions } from "@/components/pdf-share-actions";

type Vendor = { id: string; name: string };

export type CustomerStopData = {
  stopId: string;
  customerName: string;
  items: { item_id: string | null; description: string; qty: number; unit: string }[];
};

type NeededItem = { key: string; itemId: string | null; name: string; unit: string; qty: number };

type OrderRow = {
  key: string;
  itemId: string | null;
  description: string;
  unit: string;
  qty: number;
  vendorId: string;
  zone: string;
};

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
  // Who you're ordering from today — narrows the per-row supplier picker so you're not scrolling
  // a long list of suppliers you're not using.
  const [selectedVendorIds, setSelectedVendorIds] = useState<Set<string>>(() => new Set(vendors.map((v) => v.id)));
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const vendorsById = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);
  const selectedVendors = vendors.filter((v) => selectedVendorIds.has(v.id));

  // Reference only — total quantity customers actually ordered today, per item. Tap one to
  // quick-add it to the order list below.
  const needed = useMemo<NeededItem[]>(() => {
    const map = new Map<string, NeededItem>();
    for (const stop of customerStops) {
      for (const li of stop.items) {
        const key = li.item_id ?? `desc:${li.description}`;
        const catalogItem = li.item_id ? itemsById.get(li.item_id) : undefined;
        const existing = map.get(key);
        if (existing) {
          existing.qty += li.qty;
        } else {
          map.set(key, {
            key,
            itemId: li.item_id,
            name: catalogItem?.name ?? li.description,
            unit: li.unit || catalogItem?.unit || "unit",
            qty: li.qty,
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [customerStops, itemsById]);

  const toggleVendor = (vendorId: string) => {
    setSelectedVendorIds((prev) => {
      const next = new Set(prev);
      if (next.has(vendorId)) next.delete(vendorId);
      else next.add(vendorId);
      return next;
    });
  };

  const addRow = (item: { id: string | null; name: string; unit: string }, qty = 1) => {
    setRows((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        itemId: item.id,
        description: item.name,
        unit: item.unit,
        qty,
        vendorId: selectedVendors[0]?.id ?? "",
        zone: "",
      },
    ]);
  };

  const updateRow = (key: string, patch: Partial<OrderRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key));

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return items
      .filter((i) => i.name.toLowerCase().includes(q) || i.item_code?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, items]);

  const handleSearchAdd = (item: ItemOption) => {
    addRow({ id: item.id, name: item.name, unit: item.unit });
    setSearch("");
  };

  // Group the order list by supplier, then by account/zone within a supplier, for the printable
  // sheet — a zone only gets its own sub-heading when a supplier actually has more than one.
  const byVendor = useMemo(() => {
    const map = new Map<
      string,
      { vendorName: string; byZone: Map<string, { name: string; unit: string; qty: number }[]> }
    >();
    for (const row of rows) {
      if (!row.vendorId || row.qty <= 0 || !row.description.trim()) continue;
      const vendorName = vendorsById.get(row.vendorId)?.name ?? "Unassigned";
      const existing = map.get(row.vendorId) ?? { vendorName, byZone: new Map() };
      const zoneRows = existing.byZone.get(row.zone) ?? [];
      zoneRows.push({ name: row.description, unit: row.unit, qty: row.qty });
      existing.byZone.set(row.zone, zoneRows);
      map.set(row.vendorId, existing);
    }
    return Array.from(map.values());
  }, [rows, vendorsById]);

  const itemTotals = useMemo(() => {
    const map = new Map<string, { name: string; unit: string; qty: number }>();
    for (const row of rows) {
      if (!row.vendorId || row.qty <= 0 || !row.description.trim()) continue;
      const key = row.itemId ?? `desc:${row.description}`;
      const existing = map.get(key);
      if (existing) existing.qty += row.qty;
      else map.set(key, { name: row.description, unit: row.unit, qty: row.qty });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const printId = "stock-sheet-print";

  const exportExcel = async () => {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const sheetRows = [
        ["Stock count", runDate],
        [],
        ["Item totals"],
        ["Item", "Qty", "Unit"],
        ...itemTotals.map((t) => [t.name, t.qty, t.unit]),
        [],
        ["Supplier", "Account/Zone", "Item", "Qty", "Unit"],
        ...byVendor.flatMap((v) =>
          Array.from(v.byZone.entries()).flatMap(([zone, zrows]) =>
            zrows.map((r) => [v.vendorName, zone, r.name, r.qty, r.unit])
          )
        ),
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Count");
      XLSX.writeFile(workbook, `stock-count-${runDate}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          Suppliers you&apos;re ordering from today
        </p>
        {vendors.length ? (
          <div className="flex flex-wrap gap-3">
            {vendors.map((v) => (
              <label key={v.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={selectedVendorIds.has(v.id)}
                  onChange={() => toggleVendor(v.id)}
                  className="rounded border-slate-300"
                />
                {v.name}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No suppliers yet — add one first.</p>
        )}
      </div>

      {needed.length ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            Ordered by customers today (reference — tap to add)
          </p>
          <div className="flex flex-wrap gap-2">
            {needed.map((n) => (
              <button
                key={n.key}
                type="button"
                onClick={() => addRow({ id: n.itemId, name: n.name, unit: n.unit }, n.qty)}
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                + {n.qty} {n.unit} {n.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="relative rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Add any item from your catalogue
        </label>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type a name or code..."
            className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          />
        </div>
        {searchResults.length ? (
          <div className="absolute z-10 mt-1 w-[calc(100%-2rem)] overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            {searchResults.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSearchAdd(item)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <span className="text-slate-900 dark:text-slate-50">
                  {item.item_code ? `${item.item_code} - ` : ""}
                  {item.name}
                </span>
                <span className="text-xs text-slate-400">
                  <Plus size={14} className="inline" /> Add
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-50">Order list</h2>
        {!rows.length ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-400 dark:border-slate-700">
            Nothing added yet — search above or tap a suggestion to start building today&apos;s order.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="w-20 px-3 py-2 text-right font-medium">Qty</th>
                  <th className="w-20 px-3 py-2 font-medium">Unit</th>
                  <th className="px-3 py-2 font-medium">Supplier</th>
                  <th className="w-32 px-3 py-2 font-medium">Account/zone</th>
                  <th className="w-10 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="px-3 py-2 text-slate-900 dark:text-slate-50">{row.description}</td>
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
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{row.unit}</td>
                    <td className="px-3 py-2">
                      <select
                        value={row.vendorId}
                        onChange={(e) => updateRow(row.key, { vendorId: e.target.value })}
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                      >
                        <option value="">Select a supplier...</option>
                        {(selectedVendors.length ? selectedVendors : vendors).map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.zone}
                        onChange={(e) => updateRow(row.key, { zone: e.target.value })}
                        placeholder="e.g. London"
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
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
            <PdfShareActions targetId={printId} filename={`stock-count-${runDate}.pdf`} title={`Stock count — ${runDate}`} />
            <button
              onClick={exportExcel}
              disabled={exporting}
              className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Sheet size={16} /> {exporting ? "Exporting..." : "Export Excel"}
            </button>
          </div>

          <div id={printId} className="mt-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-900 dark:text-slate-50">{runDate}</p>

            <div className="mt-4 break-inside-avoid">
              <p className="font-bold text-slate-900 underline dark:text-slate-50">Item totals</p>
              {itemTotals.map((t, i) => (
                <p key={i} className="text-sm text-slate-800 dark:text-slate-200">
                  {t.qty} {t.unit} {t.name}
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
                    {zoneEntries.map(([zone, zrows]) => (
                      <div key={zone || "none"} className={multiZone ? "mt-1" : ""}>
                        {multiZone && zone ? (
                          <p className="font-bold text-slate-900 underline dark:text-slate-50">{zone}</p>
                        ) : null}
                        {zrows.map((r, i) => (
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
