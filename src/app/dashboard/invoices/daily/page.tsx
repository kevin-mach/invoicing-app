import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { DailyReportActions } from "./daily-report-actions";
import { formatGBP, roundMoney } from "@/lib/format";
import { DateInput } from "@/components/date-input";
import { getExpenses } from "@/lib/bookkeeping/data";
import { getItemsWithDefaultCost } from "@/lib/supabase/items";

export default async function DailyInvoiceReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const reportDate = date ?? new Date().toISOString().slice(0, 10);

  const org = await getCurrentOrg();
  if (!org) return null;

  const supabase = await createClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, number, status, subtotal, tax, total, customers(name), invoice_line_items(vat_amount)")
    .eq("org_id", org.orgId)
    .eq("issue_date", reportDate)
    .order("number");

  const rows = (invoices ?? []).map((inv) => {
    const vatAmount = (inv.invoice_line_items as unknown as { vat_amount: number | null }[]).reduce(
      (sum, li) => sum + (li.vat_amount ?? 0),
      0
    );
    return {
      id: inv.id,
      number: inv.number ?? inv.id.slice(0, 8),
      status: inv.status,
      customerName: (inv.customers as unknown as { name: string } | null)?.name ?? "—",
      subtotal: inv.subtotal,
      vat: vatAmount,
      tax: inv.tax,
      total: inv.total,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      subtotal: acc.subtotal + r.subtotal,
      vat: acc.vat + r.vat,
      tax: acc.tax + r.tax,
      total: acc.total + r.total,
    }),
    { subtotal: 0, vat: 0, tax: 0, total: 0 }
  );

  // The cost side of the day: everything bought, everything spent, and what that did to stock.
  const [{ data: purchaseRows }, expenses, catalog, { data: stockRows }] = await Promise.all([
    supabase
      .from("purchases")
      .select("id, receipt_url, vendors(name), purchase_line_items(item_id, description, qty, line_total, vat_amount)")
      .eq("org_id", org.orgId)
      .eq("purchase_date", reportDate)
      .order("created_at"),
    getExpenses(org.orgId, reportDate, reportDate),
    getItemsWithDefaultCost(org.orgId),
    supabase.from("items").select("id, stock_qty").eq("org_id", org.orgId).eq("is_active", true),
  ]);
  const itemQty = new Map((stockRows ?? []).map((r) => [r.id, r.stock_qty]));

  type PLine = { item_id: string | null; description: string; qty: number; line_total: number | null; vat_amount: number | null };
  const purchases = (purchaseRows ?? []).map((p) => {
    const lines = (p.purchase_line_items ?? []) as PLine[];
    const net = roundMoney(lines.reduce((s, l) => s + (l.line_total ?? 0), 0));
    const vat = roundMoney(lines.reduce((s, l) => s + (l.vat_amount ?? 0), 0));
    return { id: p.id, supplier: (p.vendors as unknown as { name: string } | null)?.name ?? "Supplier", fromReceipt: !!p.receipt_url, count: lines.length, net, vat, lines };
  });
  const purchaseNet = roundMoney(purchases.reduce((s, p) => s + p.net, 0));
  const purchaseVat = roundMoney(purchases.reduce((s, p) => s + p.vat, 0));

  // Stock that came in today, per item.
  const stockIn = new Map<string, { name: string; qty: number; cost: number }>();
  for (const p of purchases) {
    for (const l of p.lines) {
      if (!l.item_id) continue;
      const cur = stockIn.get(l.item_id) ?? { name: l.description, qty: 0, cost: 0 };
      cur.qty = roundMoney(cur.qty + l.qty);
      cur.cost = roundMoney(cur.cost + (l.line_total ?? 0));
      stockIn.set(l.item_id, cur);
    }
  }
  const stockInRows = [...stockIn.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => a.name.localeCompare(b.name));

  const expenseNet = roundMoney(expenses.reduce((s, e) => s + e.net_amount, 0));
  const expenseVat = roundMoney(expenses.reduce((s, e) => s + e.vat_amount, 0));
  const salesNet = roundMoney(totals.subtotal);
  const profit = roundMoney(salesNet - purchaseNet - expenseNet);
  const stockValue = roundMoney(catalog.reduce((s, i) => s + Math.max(0, itemQty.get(i.id) ?? 0) * i.default_cost, 0));

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Daily report</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Everything for one day in one place: what you sold, what you bought, what you spent, and what&apos;s in stock.
      </p>

      <form className="no-print mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Date</label>
          <DateInput
            name="date"
            defaultValue={reportDate}
            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          />
        </div>
        <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-50 dark:text-slate-900">
          View
        </button>
      </form>

      <div className="mt-4">
        <DailyReportActions reportDate={reportDate} />
      </div>

      <div id="daily-invoice-report" className="mt-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">{org.orgName}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Daily invoice report — {reportDate}</p>

        <table className="mt-4 w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="py-2 font-medium">Invoice</th>
              <th className="py-2 font-medium">Customer</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 text-right font-medium">Subtotal</th>
              <th className="py-2 text-right font-medium">VAT</th>
              <th className="py-2 text-right font-medium">Tax</th>
              <th className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2">{r.number}</td>
                <td className="py-2">{r.customerName}</td>
                <td className="py-2 capitalize text-slate-600 dark:text-slate-400">{r.status}</td>
                <td className="py-2 text-right">{formatGBP(r.subtotal)}</td>
                <td className="py-2 text-right">{formatGBP(r.vat)}</td>
                <td className="py-2 text-right">{formatGBP(r.tax)}</td>
                <td className="py-2 text-right font-medium">{formatGBP(r.total)}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-400">
                  No invoices issued on this date.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Subtotal</span>
              <span>{formatGBP(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>VAT</span>
              <span>{formatGBP(totals.vat)}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Tax</span>
              <span>{formatGBP(totals.tax)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
              <span>Total</span>
              <span>{formatGBP(totals.total)}</span>
            </div>
          </div>
        </div>

        <h3 className="mt-8 font-semibold text-slate-900 dark:text-slate-50">Bought today (stock and supplies)</h3>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="py-2 font-medium">Supplier</th>
              <th className="py-2 font-medium">How</th>
              <th className="py-2 text-right font-medium">Items</th>
              <th className="py-2 text-right font-medium">Before VAT</th>
              <th className="py-2 text-right font-medium">VAT</th>
              <th className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2">{p.supplier}</td>
                <td className="py-2 text-slate-600 dark:text-slate-400">{p.fromReceipt ? "Receipt" : "Order"}</td>
                <td className="py-2 text-right">{p.count}</td>
                <td className="py-2 text-right">{formatGBP(p.net)}</td>
                <td className="py-2 text-right">{formatGBP(p.vat)}</td>
                <td className="py-2 text-right font-medium">{formatGBP(roundMoney(p.net + p.vat))}</td>
              </tr>
            ))}
            {!purchases.length ? (
              <tr>
                <td colSpan={6} className="py-4 text-center text-slate-400">
                  Nothing bought on this date.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <h3 className="mt-8 font-semibold text-slate-900 dark:text-slate-50">Stock that came in today</h3>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 text-right font-medium">Quantity added</th>
              <th className="py-2 text-right font-medium">Cost (before VAT)</th>
            </tr>
          </thead>
          <tbody>
            {stockInRows.map((s) => (
              <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2">{s.name}</td>
                <td className="py-2 text-right">{s.qty}</td>
                <td className="py-2 text-right">{formatGBP(s.cost)}</td>
              </tr>
            ))}
            {!stockInRows.length ? (
              <tr>
                <td colSpan={3} className="py-4 text-center text-slate-400">
                  No stock added on this date.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Stock on hand right now: {catalog.length} item{catalog.length === 1 ? "" : "s"}, worth {formatGBP(stockValue)} at what you last paid.
        </p>

        <h3 className="mt-8 font-semibold text-slate-900 dark:text-slate-50">Spent today (expenses)</h3>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="py-2 font-medium">Paid to</th>
              <th className="py-2 font-medium">What for</th>
              <th className="py-2 text-right font-medium">Before VAT</th>
              <th className="py-2 text-right font-medium">VAT</th>
              <th className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2">{e.payee}</td>
                <td className="py-2 text-slate-600 dark:text-slate-400">{e.category}</td>
                <td className="py-2 text-right">{formatGBP(e.net_amount)}</td>
                <td className="py-2 text-right">{formatGBP(e.vat_amount)}</td>
                <td className="py-2 text-right font-medium">{formatGBP(roundMoney(e.net_amount + e.vat_amount))}</td>
              </tr>
            ))}
            {!expenses.length ? (
              <tr>
                <td colSpan={5} className="py-4 text-center text-slate-400">
                  No expenses on this date.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <h3 className="mt-8 font-semibold text-slate-900 dark:text-slate-50">How the day went</h3>
        <div className="mt-2 w-full max-w-sm space-y-1 text-sm">
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>Sold (before VAT)</span>
            <span>{formatGBP(salesNet)}</span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>Bought — stock and supplies (before VAT)</span>
            <span>-{formatGBP(purchaseNet)}</span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>Spent — expenses (before VAT)</span>
            <span>-{formatGBP(expenseNet)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
            <span>Left over (profit)</span>
            <span>{formatGBP(profit)}</span>
          </div>
          <div className="flex justify-between pt-2 text-slate-600 dark:text-slate-400">
            <span>VAT on sales</span>
            <span>{formatGBP(totals.vat)}</span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>VAT paid on purchases and expenses</span>
            <span>{formatGBP(roundMoney(purchaseVat + expenseVat))}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
