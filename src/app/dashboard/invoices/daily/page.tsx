import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { DailyReportActions } from "./daily-report-actions";
import { formatGBP } from "@/lib/format";

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

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Daily invoice report</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Every invoice issued on a given day, condensed into one report.
      </p>

      <form className="no-print mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Date</label>
          <input
            type="date"
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
      </div>
    </div>
  );
}
