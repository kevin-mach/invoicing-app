import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getItemsWithDefaultCost } from "@/lib/supabase/items";
import { requireBookkeeper } from "@/lib/bookkeeping/access";
import { getExpenses, sumBy } from "@/lib/bookkeeping/data";
import { resolvePeriod, toIsoDate } from "@/lib/bookkeeping/period";
import { formatGBP, roundMoney } from "@/lib/format";
import { PeriodFilter } from "@/components/bookkeeping/period-filter";
import { DeleteExpenseButton, ExpenseForm } from "./expense-form";
import { ReceiptsList, ReceiptTable, type ReceiptRow } from "./receipts-list";
import { RescanReceiptButton } from "./rescan-button";
import { ExpandableRow } from "@/components/expandable-row";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const org = await requireBookkeeper();
  if (!org) return null;

  const params = await searchParams;
  const { from, to } = resolvePeriod(params.from, params.to, "this-month");
  const today = toIsoDate(new Date());
  const supabase = await createClient();
  const [expenses, { data: vendorRows }, items, { data: receiptPurchaseRows }, { data: receiptRows }] = await Promise.all([
    getExpenses(org.orgId, from, to),
    supabase.from("vendors").select("id, name").eq("org_id", org.orgId).order("name"),
    getItemsWithDefaultCost(org.orgId),
    // Stock bought on a scanned shop receipt is a paid purchase, shown here too so the receipt history is in one place.
    supabase
      .from("purchases")
      .select("id, purchase_date, paid_with, receipt_url, receipt_id, vendors(name), purchase_line_items(qty, line_total, vat_amount)")
      .eq("org_id", org.orgId)
      .not("receipt_url", "is", null)
      .gte("purchase_date", from)
      .lte("purchase_date", to)
      .order("purchase_date", { ascending: false }),
    supabase
      .from("scanned_receipts")
      .select(
        "id, merchant, receipt_date, payment_method, net_total, vat_total, gross_total, tendered, change_given, receipt_url, purchase_id, scanned_receipt_lines(id, sort_order, description, qty, net_amount, vat_rate, vat_amount, category, item_group, is_stock)"
      )
      .eq("org_id", org.orgId)
      .gte("receipt_date", from)
      .lte("receipt_date", to)
      .order("receipt_date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);
  const receiptPurchases = (receiptPurchaseRows ?? []).map((p) => {
    const lines = (p.purchase_line_items ?? []) as { qty: number; line_total: number | null; vat_amount: number | null }[];
    const net = roundMoney(lines.reduce((s, l) => s + (l.line_total ?? 0), 0));
    const vat = roundMoney(lines.reduce((s, l) => s + (l.vat_amount ?? 0), 0));
    return {
      id: p.id,
      date: p.purchase_date,
      payee: (p.vendors as unknown as { name: string } | null)?.name ?? "Supplier",
      method: p.paid_with ?? "",
      receipt: p.receipt_url,
      receiptId: p.receipt_id,
      count: lines.length,
      net,
      vat,
    };
  });
  const stockReceiptsNet = roundMoney(receiptPurchases.reduce((s, p) => s + p.net, 0));

  // Receipts are stored as private paths; sign short-lived links at view time.
  const paths = [...expenses.map((e) => e.receipt_url), ...receiptPurchases.map((p) => p.receipt), ...(receiptRows ?? []).map((r) => r.receipt_url)].filter(
    (p): p is string => !!p
  );
  const signed = paths.length ? await supabase.storage.from("receipts").createSignedUrls(paths, 3600) : { data: [] };
  const linkByPath = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));

  const receiptList: ReceiptRow[] = (receiptRows ?? []).map((r) => ({
    id: r.id,
    merchant: r.merchant,
    receipt_date: r.receipt_date,
    payment_method: r.payment_method,
    net_total: r.net_total,
    vat_total: r.vat_total,
    gross_total: r.gross_total,
    tendered: r.tendered,
    change_given: r.change_given,
    purchase_id: r.purchase_id,
    receiptLink: r.receipt_url ? (linkByPath.get(r.receipt_url) ?? null) : null,
    lines: [...(r.scanned_receipt_lines ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }));
  const receiptsById = new Map(receiptList.map((r) => [r.id, r]));

  const byCategory = new Map<string, { net: number; vat: number; count: number }>();
  for (const e of expenses) {
    const cur = byCategory.get(e.category) ?? { net: 0, vat: 0, count: 0 };
    cur.net = roundMoney(cur.net + e.net_amount);
    cur.vat = roundMoney(cur.vat + e.vat_amount);
    cur.count += 1;
    byCategory.set(e.category, cur);
  }
  const categories = [...byCategory.entries()].sort((a, b) => b[1].net - a[1].net);

  return (
    <div className="space-y-6">
      <ExpenseForm orgId={org.orgId} today={today} autoSaveScans={org.autoSaveScans} vendors={vendorRows ?? []} items={items} />
      <PeriodFilter basePath="/dashboard/bookkeeping/expenses" from={from} to={to} />

      <ReceiptsList receipts={receiptList} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Paid to</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 text-right font-medium">Net</th>
                  <th className="px-4 py-3 text-right font-medium">VAT</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {receiptPurchases.map((p) => {
                  const link = p.receipt ? linkByPath.get(p.receipt) : null;
                  const receipt = p.receiptId ? receiptsById.get(p.receiptId) : undefined;
                  return (
                    <ExpandableRow
                      key={`p-${p.id}`}
                      colSpan={7}
                      className="bg-green-50/40 dark:bg-green-950/20"
                      cells={
                        <>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-400">{p.date}</td>
                          <td className="px-4 py-3">
                            <p className="text-slate-900 dark:text-slate-50">{p.payee}</p>
                            <p className="text-xs capitalize text-slate-500 dark:text-slate-400">
                              Stock purchase · {p.count} line{p.count === 1 ? "" : "s"}
                              {p.method ? ` · ${p.method}` : ""}
                              {link ? (
                                <>
                                  {" · "}
                                  <a href={link} target="_blank" rel="noreferrer" className="underline">
                                    receipt
                                  </a>
                                </>
                              ) : null}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Stock</td>
                          <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{formatGBP(p.net)}</td>
                          <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{formatGBP(p.vat)}</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-50">{formatGBP(roundMoney(p.net + p.vat))}</td>
                        </>
                      }
                      actions={
                        <Link href={`/dashboard/purchases/${p.id}`} className="text-xs text-slate-500 underline hover:text-slate-800 dark:text-slate-400">
                          Purchase
                        </Link>
                      }
                      detail={
                        receipt ? (
                          <ReceiptTable receipt={receipt} />
                        ) : (
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Open the <Link href={`/dashboard/purchases/${p.id}`} className="underline">purchase</Link> to see every item.
                          </p>
                        )
                      }
                    />
                  );
                })}
                {expenses.map((e) => {
                  const link = e.receipt_url ? linkByPath.get(e.receipt_url) : null;
                  const receipt = e.receipt_id ? receiptsById.get(e.receipt_id) : undefined;
                  return (
                    <ExpandableRow
                      key={e.id}
                      colSpan={7}
                      cells={
                        <>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-400">{e.expense_date}</td>
                          <td className="px-4 py-3">
                            <p className="text-slate-900 dark:text-slate-50">{e.payee}</p>
                            <p className="text-xs capitalize text-slate-500 dark:text-slate-400">
                              {e.payment_method}
                              {e.description ? ` · ${e.description}` : ""}
                              {e.bank_transaction_id ? " · from bank" : ""}
                              {link ? (
                                <>
                                  {" · "}
                                  <a href={link} target="_blank" rel="noreferrer" className="underline">
                                    receipt
                                  </a>
                                </>
                              ) : null}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{e.category}</td>
                          <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{formatGBP(e.net_amount)}</td>
                          <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{formatGBP(e.vat_amount)}</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-50">
                            {formatGBP(e.total_amount ?? e.net_amount + e.vat_amount)}
                          </td>
                        </>
                      }
                      actions={<DeleteExpenseButton id={e.id} label={e.payee} />}
                      detail={
                        receipt ? (
                          <ReceiptTable receipt={receipt} />
                        ) : (
                          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                            <p>
                              This one was saved as a single amount: {formatGBP(e.net_amount)} before VAT + {formatGBP(e.vat_amount)} VAT ={" "}
                              {formatGBP(e.total_amount ?? e.net_amount + e.vat_amount)}. No item list was kept.
                            </p>
                            {e.receipt_url ? (
                              <>
                                <p>The photo of the receipt is saved, so the app can read the items from it again and replace this entry with an itemised one.</p>
                                <RescanReceiptButton expenseId={e.id} receiptPath={e.receipt_url} label={e.payee} />
                              </>
                            ) : (
                              <p>To get an item list, scan the receipt above.</p>
                            )}
                          </div>
                        )
                      }
                    />
                  );
                })}
                {!expenses.length && !receiptPurchases.length ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No expenses in this period.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-semibold text-slate-900 dark:text-slate-50">By category</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {categories.map(([name, v]) => (
              <li key={name} className="flex justify-between gap-3">
                <span className="text-slate-600 dark:text-slate-400">{name}</span>
                <span className="font-medium text-slate-900 dark:text-slate-50">{formatGBP(v.net)}</span>
              </li>
            ))}
            {categories.length ? (
              <li className="flex justify-between gap-3 border-t border-slate-200 pt-2 font-semibold dark:border-slate-800">
                <span className="text-slate-900 dark:text-slate-50">Total (ex VAT)</span>
                <span className="text-slate-900 dark:text-slate-50">{formatGBP(sumBy(expenses, (e) => e.net_amount))}</span>
              </li>
            ) : (
              <li className="text-slate-400">Nothing yet.</li>
            )}
          </ul>
          {receiptPurchases.length ? (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Plus {formatGBP(stockReceiptsNet)} (ex VAT) of stock bought on scanned receipts — shown in green in the list and counted under
              Purchases, so it isn&apos;t in the totals above.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
