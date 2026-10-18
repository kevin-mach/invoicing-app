import { createClient } from "@/lib/supabase/server";
import { requireBookkeeper } from "@/lib/bookkeeping/access";
import { fetchAll, getPosSales } from "@/lib/bookkeeping/data";
import { totalStaffCost } from "@/lib/bookkeeping/payroll";
import { toIsoDate } from "@/lib/bookkeeping/period";
import { formatGBP, roundMoney } from "@/lib/format";
import { StatCard } from "@/components/bookkeeping/ui";
import { PayrollImport, PayRunActions, PayRunForm } from "./payroll-client";

export default async function PayrollPage() {
  const org = await requireBookkeeper();
  if (!org) return null;
  const today = toIsoDate(new Date());
  const supabase = await createClient();
  const yearAgo = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;

  const [{ data }, invoices, pos] = await Promise.all([
    supabase.from("pay_runs").select("*").eq("org_id", org.orgId).order("pay_date", { ascending: false }).limit(60),
    fetchAll<{ subtotal: number }>((from, to) =>
      supabase.from("invoices").select("subtotal").eq("org_id", org.orgId).neq("status", "draft").gte("issue_date", yearAgo).lte("issue_date", today).range(from, to)
    ),
    getPosSales(org.orgId, yearAgo, today),
  ]);
  const runs = data ?? [];
  const owed = runs.filter((r) => !r.hmrc_paid_on);
  const owedTotal = roundMoney(owed.reduce((s, r) => s + (r.hmrc_liability ?? 0), 0));
  const overdue = owed.filter((r) => r.hmrc_due_date < today);
  const last12 = runs.filter((r) => r.pay_date >= yearAgo);
  const cost12 = roundMoney(last12.reduce((s, r) => s + totalStaffCost(r), 0));
  const sales12 = roundMoney(invoices.reduce((s, i) => s + i.subtotal, 0) + pos.reduce((s, p) => s + p.net_sales, 0));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Owed to HMRC (PAYE/NI)"
          value={formatGBP(owedTotal)}
          tone={overdue.length > 0 ? "bad" : undefined}
          hint={overdue.length ? `${overdue.length} overdue` : owed.length ? `Next due ${owed.map((r) => r.hmrc_due_date).sort()[0]}` : "All paid"}
        />
        <StatCard label="Staff cost, last 12 months" value={formatGBP(cost12)} hint="Gross + employer NI + pension" />
        <StatCard
          label="Labour % of sales"
          value={sales12 > 0 && cost12 > 0 ? `${((cost12 / sales12) * 100).toFixed(1)}%` : "—"}
          hint="Against invoiced + POS sales (ex VAT)"
        />
        <StatCard label="Pay runs" value={String(runs.length)} />
      </div>
      <PayRunForm today={today} />
      <PayrollImport />
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Pay date</th>
              <th className="px-4 py-3 text-right font-medium">Gross</th>
              <th className="px-4 py-3 text-right font-medium">Net pay</th>
              <th className="px-4 py-3 text-right font-medium">Staff cost</th>
              <th className="px-4 py-3 text-right font-medium">HMRC owed</th>
              <th className="px-4 py-3 font-medium">HMRC due</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="whitespace-nowrap px-4 py-3 text-slate-900 dark:text-slate-50">
                  {r.pay_date}
                  <p className="text-xs text-slate-500">
                    {r.employees} employee{r.employees === 1 ? "" : "s"}
                  </p>
                </td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{formatGBP(r.gross_pay)}</td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                  {formatGBP(r.net_pay ?? 0)}
                  {r.net_pay_bank_transaction_id ? <p className="text-xs font-normal text-green-600 dark:text-green-400">Paid</p> : null}
                </td>
                <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-50">{formatGBP(totalStaffCost(r))}</td>
                <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-50">{formatGBP(r.hmrc_liability ?? 0)}</td>
                <td
                  className={`whitespace-nowrap px-4 py-3 ${
                    r.hmrc_paid_on ? "text-green-600" : r.hmrc_due_date < today ? "text-red-600" : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {r.hmrc_paid_on ? `Paid ${r.hmrc_paid_on}${r.hmrc_bank_transaction_id ? " (auto)" : ""}` : r.hmrc_due_date}
                </td>
                <td className="px-4 py-3">
                  <PayRunActions id={r.id} paidOn={r.hmrc_paid_on} today={today} />
                </td>
              </tr>
            ))}
            {!runs.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No pay runs yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
