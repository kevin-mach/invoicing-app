import { createClient } from "@/lib/supabase/server";
import { requireBookkeeper } from "@/lib/bookkeeping/access";
import { getInvoiceSummaries } from "@/lib/bookkeeping/data";
import { AGEING_BUCKETS, addDays, bucketIndex, daysBetween, dueDateFor } from "@/lib/bookkeeping/ageing";
import { toIsoDate } from "@/lib/bookkeeping/period";
import { formatGBP, roundMoney } from "@/lib/format";
import { ReceivableRow, RemovePaymentButton, type ReceivableData } from "./receivable-row";

export default async function ReceivablesPage() {
  const org = await requireBookkeeper();
  if (!org) return null;

  const today = toIsoDate(new Date());
  const supabase = await createClient();

  const open = (await getInvoiceSummaries(org.orgId, { statuses: ["sent", "overdue"] })).filter(
    (i) => i.outstanding > 0.005
  );

  const { data: payments } = open.length
    ? await supabase
        .from("invoice_payments")
        .select("id, invoice_id, amount, paid_on, method, reference")
        .in("invoice_id", open.map((i) => i.id))
        .order("paid_on")
    : { data: [] };

  const { data: recentPayments } = await supabase
    .from("invoice_payments")
    .select("id, amount, paid_on, method, reference, bank_transaction_id, invoices(number, status, total, customers(name))")
    .eq("org_id", org.orgId)
    .gte("paid_on", addDays(today, -60))
    .order("paid_on", { ascending: false })
    .limit(100);

  const rows: ReceivableData[] = open
    .map((i) => {
      const due = dueDateFor(i.dueDate, i.issueDate);
      return {
        id: i.id,
        number: i.number ?? i.id.slice(0, 8),
        customerName: i.customerName,
        customerEmail: i.customerEmail,
        issueDate: i.issueDate,
        due,
        daysOverdue: Math.max(0, daysBetween(due, today)),
        total: i.total,
        paid: i.paid,
        outstanding: i.outstanding,
        payments: (payments ?? [])
          .filter((p) => p.invoice_id === i.id)
          .map((p) => ({ id: p.id, amount: p.amount, paid_on: p.paid_on, method: p.method, reference: p.reference })),
      };
    })
    .sort((a, b) => a.due.localeCompare(b.due));

  // Ageing grid: customer × bucket.
  const byCustomer = new Map<string, number[]>();
  const totals = AGEING_BUCKETS.map(() => 0);
  for (const r of rows) {
    const b = bucketIndex(r.due, today);
    const cur = byCustomer.get(r.customerName) ?? AGEING_BUCKETS.map(() => 0);
    cur[b] = roundMoney(cur[b] + r.outstanding);
    byCustomer.set(r.customerName, cur);
    totals[b] = roundMoney(totals[b] + r.outstanding);
  }
  const grandTotal = roundMoney(totals.reduce((s, v) => s + v, 0));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total owed</p>
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
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Ageing by customer</h2>
        <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                {AGEING_BUCKETS.map((b) => (
                  <th key={b} className="px-4 py-3 text-right font-medium">
                    {b}
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {[...byCustomer.entries()].map(([customer, buckets]) => (
                <tr key={customer} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-50">{customer}</td>
                  {buckets.map((v, i) => (
                    <td key={i} className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                      {v ? formatGBP(v) : "—"}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-50">
                    {formatGBP(roundMoney(buckets.reduce((s, v) => s + v, 0)))}
                  </td>
                </tr>
              ))}
              {!byCustomer.size ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Nobody owes you anything. 🎉
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Open invoices</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Sent invoices not yet paid in full. Invoices without a due date are treated as due 30 days after they were
          issued.
        </p>
        <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Issued</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Paid</th>
                <th className="px-4 py-3 text-right font-medium">Outstanding</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <ReceivableRow key={r.id} row={r} today={today} />
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No open invoices.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Recent payments</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Payments recorded in the last 60 days. Remove one if it was entered by mistake — the invoice reopens if it
          isn&apos;t fully paid any more.
        </p>
        <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Paid</th>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Invoice status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {(recentPayments ?? []).map((p) => {
                const inv = p.invoices as unknown as {
                  number: string | null;
                  status: string;
                  total: number;
                  customers: { name: string } | null;
                } | null;
                return (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-400">{p.paid_on}</td>
                    <td className="px-4 py-3">
                      <p className="text-slate-900 dark:text-slate-50">{inv?.number ?? "—"}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{inv?.customers?.name ?? ""}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-50">{formatGBP(p.amount)}</td>
                    <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-400">
                      {p.method}
                      {p.bank_transaction_id ? " · from bank" : ""}
                      {p.reference ? ` · ${p.reference}` : ""}
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-400">{inv?.status ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <RemovePaymentButton paymentId={p.id} viaBank={!!p.bank_transaction_id} />
                    </td>
                  </tr>
                );
              })}
              {!recentPayments?.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No payments recorded in the last 60 days.
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
