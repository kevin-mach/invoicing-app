"use client";

import { useMemo, useState } from "react";
import { Printer, Sheet, Users, Truck } from "lucide-react";
import { formatGBP } from "@/lib/format";
import { PdfShareActions } from "@/components/pdf-share-actions";
import { aggregateItemTotals } from "@/lib/reports/aggregate-items";
import type { CustomerStopData } from "../stock-sheet/stock-sheet-builder";
import type { ItemOption } from "@/lib/supabase/items";

export type RunReportLine = {
  type: "purchase" | "invoice" | "cash";
  entity: string;
  description: string;
  qty: number;
  amount: number;
};

export type VendorStopData = {
  stopId: string;
  vendorName: string;
  label: string | null;
  items: { item_id: string | null; description: string; qty: number; unit: string }[];
};

const typeLabel: Record<RunReportLine["type"], string> = {
  purchase: "Purchase (cost)",
  invoice: "Invoice (revenue)",
  cash: "Cash item",
};

export function RunReportExport({
  runDate,
  orgName,
  customerStops,
  vendorStops,
  items,
  lines,
  totalCost,
  totalRevenue,
  totalCash,
}: {
  runDate: string;
  orgName: string;
  customerStops: CustomerStopData[];
  vendorStops: VendorStopData[];
  items: ItemOption[];
  lines: RunReportLine[];
  totalCost: number;
  totalRevenue: number;
  totalCash: number;
}) {
  const [tab, setTab] = useState<"customers" | "suppliers">("customers");
  const [exporting, setExporting] = useState(false);
  const [routeLabel, setRouteLabel] = useState("");

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, { name: i.name, unit: i.unit }])), [items]);
  const customerItemTotals = useMemo(() => aggregateItemTotals(customerStops, itemsById), [customerStops, itemsById]);
  const vendorItemTotals = useMemo(() => aggregateItemTotals(vendorStops, itemsById), [vendorStops, itemsById]);

  // Group vendor stops by supplier name; a supplier only gets a sub-heading per list when it
  // has more than one checklist (or that checklist was explicitly named) — otherwise it just
  // prints as a flat list, same as a supplier with a single order.
  const vendorGroups = useMemo(() => {
    const map = new Map<string, VendorStopData[]>();
    for (const stop of vendorStops) {
      const group = map.get(stop.vendorName);
      if (group) group.push(stop);
      else map.set(stop.vendorName, [stop]);
    }
    return Array.from(map.entries()).map(([vendorName, stops]) => ({ vendorName, stops }));
  }, [vendorStops]);

  const title = routeLabel.trim() ? `${runDate} ${routeLabel.trim()}` : runDate;

  const exportExcel = async () => {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const rows =
        tab === "customers"
          ? [
              ["Condensed report — Customers", runDate, orgName],
              [],
              ["Item totals"],
              ["Item", "Qty", "Unit"],
              ...customerItemTotals.map((t) => [t.name, t.qty, t.unit]),
              [],
              ["Customer", "Item", "Qty", "Unit"],
              ...customerStops.flatMap((s) => s.items.map((li) => [s.customerName, li.description, li.qty, li.unit])),
            ]
          : [
              ["Condensed report — Suppliers", runDate, orgName],
              [],
              ["Item totals"],
              ["Item", "Qty", "Unit"],
              ...vendorItemTotals.map((t) => [t.name, t.qty, t.unit]),
              [],
              ["Supplier", "List", "Item", "Qty", "Unit"],
              ...vendorStops.flatMap((s) =>
                s.items.map((li) => [s.vendorName, s.label ?? "", li.description, li.qty, li.unit])
              ),
            ];
      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, tab === "customers" ? "Customers" : "Suppliers");
      XLSX.writeFile(workbook, `condensed-report-${tab}-${runDate}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="no-print mt-4 flex gap-1 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setTab("customers")}
          className={`flex items-center gap-1 border-b-2 px-3 py-2 text-sm font-medium ${
            tab === "customers"
              ? "border-slate-900 text-slate-900 dark:border-slate-50 dark:text-slate-50"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Users size={16} /> Customers
        </button>
        <button
          onClick={() => setTab("suppliers")}
          className={`flex items-center gap-1 border-b-2 px-3 py-2 text-sm font-medium ${
            tab === "suppliers"
              ? "border-slate-900 text-slate-900 dark:border-slate-50 dark:text-slate-50"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Truck size={16} /> Suppliers
        </button>
      </div>

      <div className="no-print mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Route / area label (optional, shown on the sheet)
          </label>
          <input
            value={routeLabel}
            onChange={(e) => setRouteLabel(e.target.value)}
            placeholder="e.g. OXFORD"
            className="mt-1 w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          />
        </div>
      </div>

      <div className="no-print mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Printer size={16} /> Print
        </button>
        <PdfShareActions
          targetId={tab === "customers" ? "run-report-customers" : "run-report-suppliers"}
          filename={`condensed-report-${tab}-${runDate}${routeLabel.trim() ? `-${routeLabel.trim().replace(/\s+/g, "-").toLowerCase()}` : ""}.pdf`}
          title={`Condensed report — ${tab === "customers" ? "Customers" : "Suppliers"} — ${title}`}
        />
        <button
          onClick={exportExcel}
          disabled={exporting}
          className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Sheet size={16} /> {exporting ? "Exporting..." : "Export Excel"}
        </button>
      </div>

      {tab === "customers" ? (
        <div id="run-report-customers" className="mt-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-900 dark:text-slate-50">{title}</p>

          {customerStops.length ? (
            <>
              <div className="mt-4 break-inside-avoid">
                <p className="font-bold text-slate-900 underline dark:text-slate-50">Item totals</p>
                {customerItemTotals.map((t) => (
                  <p key={t.key} className="text-sm text-slate-800 dark:text-slate-200">
                    {t.qty} {t.unit} {t.name}
                  </p>
                ))}
              </div>

              <div className="mt-6 columns-1 gap-8 sm:columns-2 lg:columns-3">
                {customerStops.map((stop) => (
                  <div key={stop.stopId} className="mb-6 break-inside-avoid">
                    <p className="font-bold text-slate-900 underline dark:text-slate-50">{stop.customerName}</p>
                    {stop.items.map((li, i) => (
                      <p key={i} className="text-sm text-slate-800 dark:text-slate-200">
                        {li.qty} {li.unit} {li.description}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-400">No customer orders recorded for this stock sheet yet.</p>
          )}
        </div>
      ) : (
        <div id="run-report-suppliers" className="mt-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-900 dark:text-slate-50">{title}</p>

          {vendorGroups.length ? (
            <>
              <div className="mt-4 break-inside-avoid">
                <p className="font-bold text-slate-900 underline dark:text-slate-50">Item totals</p>
                {vendorItemTotals.map((t) => (
                  <p key={t.key} className="text-sm text-slate-800 dark:text-slate-200">
                    {t.qty} {t.unit} {t.name}
                  </p>
                ))}
              </div>

              <div className="mt-6 columns-1 gap-8 sm:columns-2 lg:columns-3">
                {vendorGroups.map((group) => {
                  const multiList = group.stops.length > 1 || group.stops.some((s) => s.label);
                  return (
                    <div key={group.vendorName} className="mb-6 break-inside-avoid">
                      <p className="font-bold text-slate-900 dark:text-slate-50">{group.vendorName}</p>
                      {group.stops.map((stop, i) => (
                        <div key={stop.stopId} className={multiList ? "mt-1" : ""}>
                          {multiList ? (
                            <p className="font-bold text-slate-900 underline dark:text-slate-50">
                              {stop.label || `List ${i + 1}`}
                            </p>
                          ) : null}
                          {stop.items.map((li, j) => (
                            <p key={j} className="text-sm text-slate-800 dark:text-slate-200">
                              {li.qty} {li.unit} {li.description}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-400">No supplier pickups recorded for this stock sheet yet.</p>
          )}
        </div>
      )}

      <div className="no-print mt-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Financial summary (screen only)</h3>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="py-2 font-medium">Type</th>
              <th className="py-2 font-medium">Entity</th>
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 text-slate-600 dark:text-slate-400">{typeLabel[l.type]}</td>
                <td className="py-2">{l.entity}</td>
                <td className="py-2">{l.description}</td>
                <td className="py-2 text-right">{l.qty}</td>
                <td className="py-2 text-right">{formatGBP(l.amount)}</td>
              </tr>
            ))}
            {!lines.length ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400">
                  No purchases or invoices recorded for this stock sheet yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Total cost</span>
              <span>{formatGBP(totalCost)}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Total revenue</span>
              <span>{formatGBP(totalRevenue)}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Cash items</span>
              <span>{formatGBP(totalCash)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
              <span>Profit</span>
              <span>{formatGBP(totalRevenue - totalCost)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
