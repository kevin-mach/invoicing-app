import Link from "next/link";
import { requireBookkeeper } from "@/lib/bookkeeping/access";
import { getPurchaseSummaries } from "@/lib/bookkeeping/data";
import { AGEING_BUCKETS, addDays, bucketIndex, daysBetween, dueDateFor } from "@/lib/bookkeeping/ageing";
import { toIsoDate } from "@/lib/bookkeeping/period";
import { formatGBP, roundMoney } from "@/lib/format";
import { PayableRow, type PayableData } from "./payable-row";

export default async function PayablesPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const org = await requireBookkeeper();
  if (!org) return null;

  const { show } = await searchParams;
  const showAll = show === "all";
  const today = toIsoDate(new Date());

  // Every unpaid bill plus the last 12 months of paid ones. Duplicates are checked across all of
  // these — a copy of a bill you've already paid is exactly the one worth catching.
  const everything = await getPurchaseSummaries(org.orgId, { recentOrUnpaidSince: addDays(today, -365) });
  const purchases = showAll ? everything : everything.filter((p) => p.paidOn === null);

  // Same supplier + same amount within a week of each other (identical refs are blocked in the database).
  const duplicateIds = new Set<string>();
  const groups = new Map<string, typeof purchases>();
  for (const p of everything) {
    if (p.gross <= 0.005) continue;
    const key = `${p.vendorId}|${p.gross.toFixed(2)}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate));
    for (let i = 1; i < sorted.length; i++) {
      if (daysBetween(sorted[i - 1].purchaseDate, sorted[i].purchaseDate) <= 7) {
        duplicateIds.add(sorted[i - 1].id);
        duplicateIds.add(sorted[i].id);
      }
    }
  }

  const rows: PayableData[] = purchases
    .map((p) => {
      const due = dueDateFor(p.dueDate, p.purchaseDate);
      return {
        id: p.id,
        vendorName: p.vendorName,
        supplierRef: p.supplierRef,
        purchaseDate: p.purchaseDate,
        dueDate: p.dueDate,
        due,
        daysOverdue: Math.max(0, daysBetween(due, today)),
        paidOn: p.paidOn,
        net: p.net,
        vat: p.vat,
        gross: p.gross,
        possibleDuplicate: duplicateIds.has(p.id),
      };
    })
    .sort((a, b) => (a.paidOn ? 1 : 0) - (b.paidOn ? 1 : 0) || a.due.localeCompare(b.due));

  const unpaid = rows.filter((r) => !r.paidOn);
  const totals = AGEING_BUCKETS.map(() => 0);
  for (const r of unpaid) {
    const b = bucketIndex(r.due, today);
    totals[b] = roundMoney(totals[b] + r.gross);
  }
  const grandTotal = roundMoney(totals.reduce((s, v) => s + v, 0));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total you owe</p>
          <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-50">{formatGBP(grandTotal)}</p>
        </div>
        {AGEING_BUCKETS.map((label, i) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
            <p
              className={`mt-1 text-xl font-semibold ${i > 0 && totals[i] > 0 ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-slate-50"}`}
            >
              {formatGBP(totals[i])}
            </p>
          </div>
        ))}
      </div>

      <div>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Supplier bills</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Bills come from Purchases. Set a supplier invoice number and due date here; bills without a due date are
              treated as due 30 days after purchase.
            </p>
          </div>
          <div className="flex gap-2">
            {[
              { key: "unpaid", label: "Unpaid", href: "/dashboard/bookkeeping/payables" },
              { key: "all", label: "Last 12 months", href: "/dashboard/bookkeeping/payables?show=all" },
            ].map((t) => (
              <Link
                key={t.key}
                href={t.href}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  (t.key === "all") === showAll
                    ? "bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900"
                    : "border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Due / paid</th>
                <th className="px-4 py-3 text-right font-medium">Net</th>
                <th className="px-4 py-3 text-right font-medium">VAT</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <PayableRow key={r.id} row={r} today={today} />
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No bills to show.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
