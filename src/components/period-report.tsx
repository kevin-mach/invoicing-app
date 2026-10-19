import { createClient } from "@/lib/supabase/server";
import { formatGBP, roundMoney } from "@/lib/format";
import { getExpenses } from "@/lib/bookkeeping/data";
import { getItemsWithDefaultCost } from "@/lib/supabase/items";
import { titleForRange } from "@/lib/period";
import { ReceiptsList } from "@/app/dashboard/bookkeeping/expenses/receipts-list";

type PLine = { item_id: string | null; description: string; qty: number; line_total: number | null; vat_amount: number | null };

/** The full report for any stretch of time — one day, a month, a year: what was sold, what was
 * bought, what stock came in, what was spent (with every scanned receipt itemised), what was left
 * over, and the VAT. */
export async function PeriodReport({
  orgId,
  orgName,
  from,
  to,
  containerId,
}: {
  orgId: string;
  orgName: string;
  from: string;
  to: string;
  containerId: string;
}) {
  const supabase = await createClient();
  const [{ data: invoices }, { data: purchaseRows }, expenses, catalog, { data: stockRows }, { data: receiptRows }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, number, status, issue_date, subtotal, tax, total, customers(name), invoice_line_items(vat_amount)")
      .eq("org_id", orgId)
      .gte("issue_date", from)
      .lte("issue_date", to)
      .order("issue_date")
      .order("number")
      .limit(5000),
    supabase
      .from("purchases")
      .select("id, purchase_date, receipt_url, vendors(name), purchase_line_items(item_id, description, qty, line_total, vat_amount)")
      .eq("org_id", orgId)
      .gte("purchase_date", from)
      .lte("purchase_date", to)
      .order("purchase_date")
      .limit(5000),
    getExpenses(orgId, from, to),
    getItemsWithDefaultCost(orgId),
    supabase.from("items").select("id, stock_qty").eq("org_id", orgId).eq("is_active", true),
    supabase
      .from("scanned_receipts")
      .select("id, merchant, receipt_date, payment_method, net_total, vat_total, gross_total, purchase_id, scanned_receipt_lines(id, sort_order, description, qty, net_amount, vat_rate, vat_amount, category, item_group, is_stock)")
      .eq("org_id", orgId)
      .gte("receipt_date", from)
      .lte("receipt_date", to)
      .order("receipt_date")
      .limit(1000),
  ]);

  const sales = (invoices ?? []).map((inv) => ({
    id: inv.id,
    date: inv.issue_date,
    number: inv.number ?? inv.id.slice(0, 8),
    status: inv.status,
    customer: (inv.customers as unknown as { name: string } | null)?.name ?? "—",
    subtotal: inv.subtotal,
    vat: (inv.invoice_line_items as unknown as { vat_amount: number | null }[]).reduce((s, l) => s + (l.vat_amount ?? 0), 0),
    total: inv.total,
  }));
  const salesNet = roundMoney(sales.reduce((s, r) => s + r.subtotal, 0));
  const salesVat = roundMoney(sales.reduce((s, r) => s + r.vat, 0));
  const salesTotal = roundMoney(sales.reduce((s, r) => s + r.total, 0));

  const purchases = (purchaseRows ?? []).map((p) => {
    const lines = (p.purchase_line_items ?? []) as PLine[];
    return {
      id: p.id,
      date: p.purchase_date,
      supplier: (p.vendors as unknown as { name: string } | null)?.name ?? "Supplier",
      fromReceipt: !!p.receipt_url,
      count: lines.length,
      net: roundMoney(lines.reduce((s, l) => s + (l.line_total ?? 0), 0)),
      vat: roundMoney(lines.reduce((s, l) => s + (l.vat_amount ?? 0), 0)),
      lines,
    };
  });
  const purchaseNet = roundMoney(purchases.reduce((s, p) => s + p.net, 0));
  const purchaseVat = roundMoney(purchases.reduce((s, p) => s + p.vat, 0));

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

  const itemQty = new Map((stockRows ?? []).map((r) => [r.id, r.stock_qty]));
  const stockValue = roundMoney(catalog.reduce((s, i) => s + Math.max(0, itemQty.get(i.id) ?? 0) * i.default_cost, 0));

  const expenseNet = roundMoney(expenses.reduce((s, e) => s + e.net_amount, 0));
  const expenseVat = roundMoney(expenses.reduce((s, e) => s + e.vat_amount, 0));
  const profit = roundMoney(salesNet - purchaseNet - expenseNet);

  const heading = "mt-8 font-semibold text-slate-900 dark:text-slate-50";
  const th = "py-2 font-medium";

  return (
    <div id={containerId} className="mt-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">{orgName}</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">Report for {titleForRange(from, to)}</p>

      <h3 className="mt-6 font-semibold text-slate-900 dark:text-slate-50">Sold (invoices)</h3>
      <div className="overflow-x-auto">
        <table className="mt-2 w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className={th}>Date</th>
              <th className={th}>Customer</th>
              <th className={th}>Status</th>
              <th className={`${th} text-right`}>Before VAT</th>
              <th className={`${th} text-right`}>VAT</th>
              <th className={`${th} text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2">{r.date}</td>
                <td className="py-2">{r.customer}</td>
                <td className="py-2 capitalize text-slate-600 dark:text-slate-400">{r.status}</td>
                <td className="py-2 text-right">{formatGBP(r.subtotal)}</td>
                <td className="py-2 text-right">{formatGBP(r.vat)}</td>
                <td className="py-2 text-right font-medium">{formatGBP(r.total)}</td>
              </tr>
            ))}
            {!sales.length ? (
              <tr>
                <td colSpan={6} className="py-4 text-center text-slate-400">
                  No invoices in this period.
                </td>
              </tr>
            ) : (
              <tr className="font-semibold">
                <td className="py-2" colSpan={3}>
                  Total sold
                </td>
                <td className="py-2 text-right">{formatGBP(salesNet)}</td>
                <td className="py-2 text-right">{formatGBP(salesVat)}</td>
                <td className="py-2 text-right">{formatGBP(salesTotal)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 className={heading}>Bought (stock and supplies)</h3>
      <div className="overflow-x-auto">
        <table className="mt-2 w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className={th}>Date</th>
              <th className={th}>Supplier</th>
              <th className={th}>How</th>
              <th className={`${th} text-right`}>Items</th>
              <th className={`${th} text-right`}>Before VAT</th>
              <th className={`${th} text-right`}>VAT</th>
              <th className={`${th} text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2">{p.date}</td>
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
                <td colSpan={7} className="py-4 text-center text-slate-400">
                  Nothing bought in this period.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <h3 className={heading}>Stock that came in</h3>
      <div className="overflow-x-auto">
        <table className="mt-2 w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className={th}>Item</th>
              <th className={`${th} text-right`}>Quantity added</th>
              <th className={`${th} text-right`}>Cost (before VAT)</th>
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
                  No stock added in this period.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Stock on hand right now: {catalog.length} item{catalog.length === 1 ? "" : "s"}, worth {formatGBP(stockValue)} at what you last paid.
      </p>

      <h3 className={heading}>Spent (expenses)</h3>
      <div className="overflow-x-auto">
        <table className="mt-2 w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className={th}>Date</th>
              <th className={th}>Paid to</th>
              <th className={th}>What for</th>
              <th className={`${th} text-right`}>Before VAT</th>
              <th className={`${th} text-right`}>VAT</th>
              <th className={`${th} text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2">{e.expense_date}</td>
                <td className="py-2">{e.payee}</td>
                <td className="py-2 text-slate-600 dark:text-slate-400">{e.category}</td>
                <td className="py-2 text-right">{formatGBP(e.net_amount)}</td>
                <td className="py-2 text-right">{formatGBP(e.vat_amount)}</td>
                <td className="py-2 text-right font-medium">{formatGBP(roundMoney(e.net_amount + e.vat_amount))}</td>
              </tr>
            ))}
            {!expenses.length ? (
              <tr>
                <td colSpan={6} className="py-4 text-center text-slate-400">
                  No expenses in this period.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {(receiptRows ?? []).length ? (
        <div className="mt-8">
          <ReceiptsList
            readOnly
            title="Receipts in this period (every item)"
            receipts={(receiptRows ?? []).map((r) => ({
              id: r.id,
              merchant: r.merchant,
              receipt_date: r.receipt_date,
              payment_method: r.payment_method,
              net_total: r.net_total,
              vat_total: r.vat_total,
              gross_total: r.gross_total,
              purchase_id: r.purchase_id,
              receiptLink: null,
              lines: [...(r.scanned_receipt_lines ?? [])].sort((a, b) => a.sort_order - b.sort_order),
            }))}
          />
        </div>
      ) : null}

      <h3 className={heading}>How it went</h3>
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
          <span>{formatGBP(salesVat)}</span>
        </div>
        <div className="flex justify-between text-slate-600 dark:text-slate-400">
          <span>VAT paid on purchases and expenses</span>
          <span>{formatGBP(roundMoney(purchaseVat + expenseVat))}</span>
        </div>
      </div>
    </div>
  );
}
