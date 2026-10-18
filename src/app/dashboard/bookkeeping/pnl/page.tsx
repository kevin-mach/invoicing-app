import { requireBookkeeper } from "@/lib/bookkeeping/access";
import { createClient } from "@/lib/supabase/server";
import { getExpenses, getInvoiceLines, getPosSales, getPurchaseSummaries } from "@/lib/bookkeeping/data";
import { totalStaffCost } from "@/lib/bookkeeping/payroll";
import { resolvePeriod } from "@/lib/bookkeeping/period";
import { formatGBP, roundMoney } from "@/lib/format";
import { PeriodFilter } from "@/components/bookkeeping/period-filter";

function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  let [y, m] = from.slice(0, 7).split("-").map(Number);
  const [endY, endM] = to.slice(0, 7).split("-").map(Number);
  while (y < endY || (y === endY && m <= endM)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}

const pct = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "—");

export default async function ProfitAndLossPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const org = await requireBookkeeper();
  if (!org) return null;

  const params = await searchParams;
  const { from, to } = resolvePeriod(params.from, params.to, "this-year");

  const supabase = await createClient();
  const [lines, purchases, expenses, pos, { data: payRuns }] = await Promise.all([
    getInvoiceLines(org.orgId, from, to),
    getPurchaseSummaries(org.orgId, { from, to }),
    getExpenses(org.orgId, from, to),
    getPosSales(org.orgId, from, to),
    supabase.from("pay_runs").select("pay_date, gross_pay, employer_ni, employer_pension").eq("org_id", org.orgId).gte("pay_date", from).lte("pay_date", to),
  ]);

  const months = monthsBetween(from, to);
  const rows = months.map((month) => {
    const sales = roundMoney(
      lines.filter((l) => l.issueDate.startsWith(month)).reduce((s, l) => s + l.net, 0) +
        pos.filter((p) => p.sales_date.startsWith(month)).reduce((s, p) => s + p.net_sales, 0)
    );
    const staff = roundMoney((payRuns ?? []).filter((r) => r.pay_date.startsWith(month)).reduce((s, r) => s + totalStaffCost(r), 0));
    const cogs = roundMoney(purchases.filter((p) => p.purchaseDate.startsWith(month)).reduce((s, p) => s + p.net, 0));
    const exp = roundMoney(expenses.filter((e) => e.expense_date.startsWith(month)).reduce((s, e) => s + e.net_amount, 0));
    return { month, sales, cogs, gross: roundMoney(sales - cogs), staff, exp, net: roundMoney(sales - cogs - staff - exp) };
  });

  const totals = rows.reduce(
    (t, r) => ({
      sales: roundMoney(t.sales + r.sales),
      cogs: roundMoney(t.cogs + r.cogs),
      gross: roundMoney(t.gross + r.gross),
      exp: roundMoney(t.exp + r.exp),
      staff: roundMoney(t.staff + r.staff),
      net: roundMoney(t.net + r.net),
    }),
    { sales: 0, cogs: 0, gross: 0, exp: 0, staff: 0, net: 0 }
  );

  const byCategory = new Map<string, number>();
  for (const e of expenses) byCategory.set(e.category, roundMoney((byCategory.get(e.category) ?? 0) + e.net_amount));
  const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  const tone = (n: number) => (n >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400");

  return (
    <div className="space-y-6">
      <PeriodFilter basePath="/dashboard/bookkeeping/pnl" from={from} to={to} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Sales (ex VAT)", value: formatGBP(totals.sales), sub: "" },
          { label: "Gross profit", value: formatGBP(totals.gross), sub: `${pct(totals.gross, totals.sales)} margin` },
          { label: "Food & stock cost", value: formatGBP(totals.cogs), sub: `${pct(totals.cogs, totals.sales)} of sales` },
          { label: "Staff cost", value: formatGBP(totals.staff), sub: totals.staff ? `${pct(totals.staff, totals.sales)} of sales` : "No pay runs recorded" },
          { label: "Net profit", value: formatGBP(totals.net), sub: `${pct(totals.net, totals.sales)} of sales`, tone: tone(totals.net) },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">{c.label}</p>
            <p className={`mt-1 text-xl font-semibold ${c.tone ?? "text-slate-900 dark:text-slate-50"}`}>{c.value}</p>
            {c.sub ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{c.sub}</p> : null}
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Month</th>
              <th className="px-4 py-3 text-right font-medium">Sales</th>
              <th className="px-4 py-3 text-right font-medium">Purchases</th>
              <th className="px-4 py-3 text-right font-medium">Gross profit</th>
              <th className="px-4 py-3 text-right font-medium">Staff</th>
              <th className="px-4 py-3 text-right font-medium">Expenses</th>
              <th className="px-4 py-3 text-right font-medium">Net profit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month} className="border-b border-slate-100 dark:border-slate-800">
                <td className="px-4 py-3 text-slate-900 dark:text-slate-50">{r.month}</td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{formatGBP(r.sales)}</td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{formatGBP(r.cogs)}</td>
                <td className={`px-4 py-3 text-right ${tone(r.gross)}`}>{formatGBP(r.gross)}</td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{formatGBP(r.staff)}</td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{formatGBP(r.exp)}</td>
                <td className={`px-4 py-3 text-right font-medium ${tone(r.net)}`}>{formatGBP(r.net)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="px-4 py-3 text-slate-900 dark:text-slate-50">Total</td>
              <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-50">{formatGBP(totals.sales)}</td>
              <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-50">{formatGBP(totals.cogs)}</td>
              <td className={`px-4 py-3 text-right ${tone(totals.gross)}`}>{formatGBP(totals.gross)}</td>
              <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-50">{formatGBP(totals.staff)}</td>
              <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-50">{formatGBP(totals.exp)}</td>
              <td className={`px-4 py-3 text-right ${tone(totals.net)}`}>{formatGBP(totals.net)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-semibold text-slate-900 dark:text-slate-50">Expenses by category</h2>
        <ul className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {categories.map(([name, value]) => (
            <li key={name} className="flex justify-between gap-3">
              <span className="text-slate-600 dark:text-slate-400">{name}</span>
              <span className="font-medium text-slate-900 dark:text-slate-50">
                {formatGBP(value)} <span className="font-normal text-slate-400">({pct(value, totals.sales)})</span>
              </span>
            </li>
          ))}
          {!categories.length ? <li className="text-slate-400">No expenses in this period.</li> : null}
        </ul>
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400">
        Sales are sent and paid invoices (drafts excluded) by invoice date, plus POS net sales. Staff is gross pay + employer NI + employer pension by pay date. Purchases are supplier bills by purchase
        date — a stock-purchases basis, so it can differ from the Sales report, which uses the cost on each invoice
        line. All figures exclude VAT.
      </p>
    </div>
  );
}
