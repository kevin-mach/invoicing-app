import { getCurrentCustomerMember } from "@/lib/supabase/identity";
import { getCustomerInvoices } from "@/lib/supabase/portal-queries";
import { formatGBP } from "@/lib/format";

export default async function CustomerPortalReportsPage() {
  const member = await getCurrentCustomerMember();
  if (!member) return null;

  const invoices = await getCustomerInvoices(member.customerId);

  const byMonth = new Map<string, { count: number; total: number }>();
  for (const inv of invoices) {
    const month = inv.issue_date.slice(0, 7);
    const existing = byMonth.get(month) ?? { count: 0, total: 0 };
    existing.count += 1;
    existing.total += inv.total;
    byMonth.set(month, existing);
  }
  const months = Array.from(byMonth.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  const totalSpend = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalPaid = invoices.filter((inv) => inv.status === "paid").reduce((sum, inv) => sum + inv.total, 0);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Reports</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your own invoice history, by month.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total invoiced</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">{formatGBP(totalSpend)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total paid</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">{formatGBP(totalPaid)}</p>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Month</th>
              <th className="px-4 py-3 text-right font-medium">Invoices</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {months.map(([month, stats]) => (
              <tr key={month} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="px-4 py-3 text-slate-900 dark:text-slate-50">{month}</td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{stats.count}</td>
                <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-50">{formatGBP(stats.total)}</td>
              </tr>
            ))}
            {!months.length ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                  No invoices yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
