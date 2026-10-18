import { createClient } from "@/lib/supabase/server";
import { requireBookkeeper } from "@/lib/bookkeeping/access";
import { getExpenses, sumBy } from "@/lib/bookkeeping/data";
import { resolvePeriod, toIsoDate } from "@/lib/bookkeeping/period";
import { formatGBP, roundMoney } from "@/lib/format";
import { PeriodFilter } from "@/components/bookkeeping/period-filter";
import { DeleteExpenseButton, ExpenseForm } from "./expense-form";

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
  const expenses = await getExpenses(org.orgId, from, to);

  // Receipts are stored as private paths; sign short-lived links at view time.
  const supabase = await createClient();
  const paths = expenses.map((e) => e.receipt_url).filter((p): p is string => !!p);
  const signed = paths.length ? await supabase.storage.from("receipts").createSignedUrls(paths, 3600) : { data: [] };
  const linkByPath = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));

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
      <ExpenseForm orgId={org.orgId} today={today} autoSaveScans={org.autoSaveScans} />
      <PeriodFilter basePath="/dashboard/bookkeeping/expenses" from={from} to={to} />

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
                {expenses.map((e) => {
                  const link = e.receipt_url ? linkByPath.get(e.receipt_url) : null;
                  return (
                    <tr key={e.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
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
                      <td className="px-4 py-3 text-right">
                        <DeleteExpenseButton id={e.id} label={e.payee} />
                      </td>
                    </tr>
                  );
                })}
                {!expenses.length ? (
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
        </div>
      </div>
    </div>
  );
}
