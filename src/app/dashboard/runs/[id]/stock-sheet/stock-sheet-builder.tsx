"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Printer, Search, Sheet, X } from "lucide-react";
import type { ItemOption } from "@/lib/supabase/items";
import { PdfShareActions } from "@/components/pdf-share-actions";
import { roundQty } from "@/lib/format";
import { ScanButton } from "@/components/bookkeeping/scan-button";
import type { ScanExtraction } from "@/lib/scan/extract";
import { matchCatalogItem } from "@/lib/scan/match-items";
import { useNewEntriesPrompt, type ProposedEntry } from "@/components/bookkeeping/use-new-entries";

type Vendor = { id: string; name: string };

type Suggestion = { item_id: string; description: string; unit_price: number; count: number };

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
  items: baseItems,
}: {
  runDate: string;
  customerStops: CustomerStopData[];
  vendors: Vendor[];
  items: ItemOption[];
}) {
  const [extraItems, setExtraItems] = useState<ItemOption[]>([]);
  const items = useMemo(() => [...baseItems, ...extraItems.filter((e) => !baseItems.some((i) => i.id === e.id))], [baseItems, extraItems]);
  const { ask, prompt } = useNewEntriesPrompt();
  const [scanNote, setScanNote] = useState<string | null>(null);
  // Who you're ordering from today — narrows which suppliers get a "frequently ordered" quick-add
  // panel. It never hides an already-assigned supplier from a row's dropdown.
  const [selectedVendorIds, setSelectedVendorIds] = useState<Set<string>>(() => new Set(vendors.map((v) => v.id)));
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [suggestionsByVendor, setSuggestionsByVendor] = useState<Record<string, Suggestion[]>>({});
  const [accounts, setAccounts] = useState<string[]>([]);
  const [newAccount, setNewAccount] = useState("");

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const vendorsById = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);
  const selectedVendors = vendors.filter((v) => selectedVendorIds.has(v.id));
  const selectedVendorIdsKey = useMemo(() => Array.from(selectedVendorIds).sort().join(","), [selectedVendorIds]);

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
          existing.qty = roundQty(existing.qty + li.qty);
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

  // Frequently-ordered quick-add pills per selected supplier, reusing the same suggestion
  // endpoint the run checklists use.
  useEffect(() => {
    let cancelled = false;
    const ids = selectedVendorIdsKey ? selectedVendorIdsKey.split(",") : [];
    Promise.all(
      ids.map((id) =>
        fetch(`/api/vendors/${id}/suggested-items`)
          .then((r) => r.json())
          .then((data) => [id, (data.suggestions ?? []) as Suggestion[]] as const)
          .catch(() => [id, [] as Suggestion[]] as const)
      )
    ).then((results) => {
      if (!cancelled) setSuggestionsByVendor(Object.fromEntries(results));
    });
    return () => {
      cancelled = true;
    };
  }, [selectedVendorIdsKey]);

  const toggleVendor = (vendorId: string) => {
    setSelectedVendorIds((prev) => {
      const next = new Set(prev);
      if (next.has(vendorId)) next.delete(vendorId);
      else next.add(vendorId);
      return next;
    });
  };

  const addAccount = () => {
    const trimmed = newAccount.trim();
    if (trimmed && !accounts.includes(trimmed)) setAccounts((prev) => [...prev, trimmed]);
    setNewAccount("");
  };
  const removeAccount = (name: string) => setAccounts((prev) => prev.filter((a) => a !== name));

  // Only auto-fill the supplier when there's exactly one candidate — with several selected,
  // guessing which one would just create more corrections than it saves.
  const defaultVendorId = selectedVendors.length === 1 ? selectedVendors[0].id : "";

  const addRow = (item: { id: string | null; name: string; unit: string }, qty = 1, vendorId = defaultVendorId) => {
    setRows((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        itemId: item.id,
        description: item.name,
        unit: item.unit,
        qty: roundQty(qty),
        vendorId,
        zone: "",
      },
    ]);
  };

  // A photo of what needs ordering (a handwritten list, the empty shelves). The sheet has no save
  // step — it builds as you go — so the lines go straight into the order list.
  const handleScanned = async (data: ScanExtraction) => {
    if (data.kind !== "list") return;
    let catalogList: ItemOption[] = items;

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
    if (proposed.size) {
      const created = await ask([...proposed.values()]);
      if (created) {
        catalogList = [...catalogList, ...created.items];
        setExtraItems((p) => [...p, ...created.items]);
      }
    }

    let oneOff = 0;
    const added: OrderRow[] = data.items.map((line) => {
      const item = matchCatalogItem(line.description, catalogList);
      if (!item) oneOff++;
      return {
        key: crypto.randomUUID(),
        itemId: item?.id ?? null,
        description: item ? item.name : line.description,
        unit: item?.unit ?? line.unit ?? "unit",
        qty: roundQty(line.qty),
        vendorId: defaultVendorId,
        zone: "",
      };
    });
    setRows((prev) => [...prev, ...added]);
    setScanNote(
      `Added ${added.length} line${added.length === 1 ? "" : "s"} to the order list${oneOff ? ` (${oneOff} one-off, not in your catalogue)` : ""}.${
        defaultVendorId ? "" : " Pick a supplier on each row — lines without one stay off the printed sheet."
      }`
    );
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

  const addSuggestion = (vendorId: string, s: Suggestion) => {
    const item = itemsById.get(s.item_id);
    addRow({ id: s.item_id, name: item?.name ?? s.description, unit: item?.unit ?? "unit" }, 1, vendorId);
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
      if (existing) existing.qty = roundQty(existing.qty + row.qty);
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

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Accounts / zones (optional)</p>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Add account names once here (e.g. &quot;LEE FOOD SUPPLIES&quot;, &quot;LEE FOOD 2&quot;), then pick one per
          row below — give a supplier rows in two different accounts to split it into two lists.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {accounts.map((a) => (
            <span
              key={a}
              className="flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              {a}
              <button
                type="button"
                onClick={() => removeAccount(a)}
                aria-label={`Remove ${a}`}
                className="text-slate-400 hover:text-red-600"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <input
            value={newAccount}
            onChange={(e) => setNewAccount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addAccount();
              }
            }}
            placeholder="e.g. LEE FOOD SUPPLIES"
            className="w-48 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          />
          <button
            type="button"
            onClick={addAccount}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Add
          </button>
        </div>
      </div>

      {selectedVendors.map((v) => {
        const sugg = suggestionsByVendor[v.id] ?? [];
        if (!sugg.length) return null;
        return (
          <div key={v.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              Frequently picked up from {v.name} (tap to add)
            </p>
            <div className="flex flex-wrap gap-2">
              {sugg.map((s) => (
                <button
                  key={s.item_id}
                  type="button"
                  onClick={() => addSuggestion(v.id, s)}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  + {s.description}
                </button>
              ))}
            </div>
          </div>
        );
      })}

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Order list</h2>
          <ScanButton kind="list" label="Scan a photo of what's needed" onExtracted={handleScanned} />
        </div>
        <div className="mt-2 space-y-2">
          {prompt}
          {scanNote ? <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-400">{scanNote}</p> : null}
        </div>
        <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
          To give one supplier more than one list (e.g. for separate invoices), add accounts above and pick a
          different account per row for that supplier.
        </p>
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
                        onChange={(e) => updateRow(row.key, { qty: roundQty(Number(e.target.value) || 0) })}
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
                        {vendors.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.zone}
                        onChange={(e) => updateRow(row.key, { zone: e.target.value })}
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                      >
                        <option value="">No account</option>
                        {accounts.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
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
