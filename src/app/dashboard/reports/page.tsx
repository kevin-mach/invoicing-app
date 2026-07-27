import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { aggregateSales, type Granularity } from "@/lib/reports/sales";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; granularity?: string }>;
}) {
  const { customerId, granularity: granularityParam } = await searchParams;
  const granularity: Granularity =
    granularityParam === "day" || granularityParam === "year" ? granularityParam : "month";

  const org = await getCurrentOrg();
  if (!org) return null;

  const supabase = await createClient();
  const [{ data: customers }, { data: lineItems }] = await Promise.all([
    supabase.from("customers").select("id, name").eq("org_id", org.orgId).order("name"),
    (() => {
      let q = supabase
        .from("invoice_line_items")
        .select("qty, unit_cost, unit_price, invoices!inner(org_id, customer_id, issue_date, customers(name))")
        .eq("invoices.org_id", org.orgId);
      if (customerId) q = q.eq("invoices.customer_id", customerId);
      return q;
    })(),
  ]);

  const rows = (lineItems ?? []).map((li) => {
    const invoice = li.invoices as unknown as { customer_id: string; issue_date: string; customers: { name: string } | null };
    return {
      customerId: invoice.customer_id,
      customerName: invoice.customers?.name ?? "—",
      issueDate: invoice.issue_date,
      qty: li.qty,
      unitCost: li.unit_cost,
      unitPrice: li.unit_price,
    };
  });

  const buckets = aggregateSales(rows, granularity);
  const totals = buckets.reduce(
    (acc, b) => ({ revenue: acc.revenue + b.revenue, cost: acc.cost + b.cost, profit: acc.profit + b.profit }),
    { revenue: 0, cost: 0, profit: 0 }
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Sales report</h1>

      <form className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Customer</label>
          <select
            name="customerId"
            defaultValue={customerId ?? ""}
            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          >
            <option value="">All customers</option>
            {customers?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Group by</label>
          <select
            name="granularity"
            defaultValue={granularity}
            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          >
            <option value="day">Daily</option>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
          </select>
        </div>
        <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-50 dark:text-slate-900">
          Apply
        </button>
      </form>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Revenue</p>
          <p className="text-xl font-semibold text-slate-900 dark:text-slate-50">${totals.revenue.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Cost</p>
          <p className="text-xl font-semibold text-slate-900 dark:text-slate-50">${totals.cost.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Profit</p>
          <p className={`text-xl font-semibold ${totals.profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            ${totals.profit.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Period</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 text-right font-medium">Revenue</th>
              <th className="px-4 py-3 text-right font-medium">Cost</th>
              <th className="px-4 py-3 text-right font-medium">Profit</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={`${b.period}-${b.customerName}`} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="px-4 py-3 text-slate-900 dark:text-slate-50">{b.period}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{b.customerName}</td>
                <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-50">${b.revenue.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-50">${b.cost.toFixed(2)}</td>
                <td className={`px-4 py-3 text-right font-medium ${b.profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  ${b.profit.toFixed(2)}
                </td>
              </tr>
            ))}
            {!buckets.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No sales in this period yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
