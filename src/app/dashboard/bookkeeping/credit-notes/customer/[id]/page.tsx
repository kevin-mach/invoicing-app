import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireBookkeeper } from "@/lib/bookkeeping/access";
import { toIsoDate } from "@/lib/bookkeeping/period";
import { formatGBP, roundMoney } from "@/lib/format";
import { CustomerCreditActions } from "./credit-actions";

export default async function CustomerCreditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await requireBookkeeper();
  if (!org) return null;

  const supabase = await createClient();
  const { data: note } = await supabase
    .from("customer_credit_notes")
    .select("*, customers(name, address, email), invoices(id, number, issue_date), customer_credit_note_lines(id, sort_order, description, qty, unit_price, net_amount, vat_rate, vat_amount)")
    .eq("id", id)
    .eq("org_id", org.orgId)
    .maybeSingle();
  if (!note) notFound();

  const customer = note.customers as unknown as { name: string; address: string | null; email: string | null } | null;
  const invoice = note.invoices as unknown as { id: string; number: string | null; issue_date: string } | null;
  const lines = [...(note.customer_credit_note_lines ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const gross = note.gross_total ?? roundMoney(note.net_total + note.vat_total);
  const statusText = note.status === "applied" ? `Taken off the invoice on ${note.settled_on}` : note.status === "refunded" ? `Refunded on ${note.settled_on}` : "Open";

  return (
    <div className="max-w-3xl space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link href="/dashboard/bookkeeping/credit-notes?view=customers" className="text-sm text-slate-500 underline dark:text-slate-400">
          ← All customer credit notes
        </Link>
        <CustomerCreditActions id={note.id} status={note.status} hasInvoice={!!invoice} today={toIsoDate(new Date())} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">{org.orgName}</p>
            {org.vatNumber ? <p className="text-sm text-slate-500 dark:text-slate-400">VAT no. {org.vatNumber}</p> : null}
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">CREDIT NOTE</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">{note.number}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Date: {note.credit_date}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">To</p>
            <p className="text-slate-900 dark:text-slate-50">{customer?.name ?? "—"}</p>
            {customer?.address ? <p className="whitespace-pre-line text-sm text-slate-600 dark:text-slate-400">{customer.address}</p> : null}
          </div>
          <div className="sm:text-right">
            {invoice ? (
              <>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Against invoice</p>
                <Link href={`/dashboard/invoices/${invoice.id}`} className="text-slate-900 underline-offset-2 hover:underline dark:text-slate-50">
                  {invoice.number ?? invoice.id.slice(0, 8)}
                </Link>
                <p className="text-sm text-slate-600 dark:text-slate-400">dated {invoice.issue_date}</p>
              </>
            ) : null}
            <p className="no-print mt-2 text-sm text-slate-500">Status: {statusText}</p>
          </div>
        </div>

        {note.reason ? <p className="mt-4 text-sm text-slate-700 dark:text-slate-300">Reason: {note.reason}</p> : null}

        <table className="mt-6 w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
            <tr>
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Price</th>
              <th className="py-2 text-right font-medium">VAT</th>
              <th className="py-2 text-right font-medium">Net</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 text-slate-900 dark:text-slate-50">{l.description}</td>
                <td className="py-2 text-right">{l.qty}</td>
                <td className="py-2 text-right">{formatGBP(l.unit_price)}</td>
                <td className="py-2 text-right">{l.vat_rate}%</td>
                <td className="py-2 text-right">{formatGBP(l.net_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>Net</span>
            <span>{formatGBP(note.net_total)}</span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>VAT</span>
            <span>{formatGBP(note.vat_total)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
            <span>Total credit</span>
            <span>{formatGBP(gross)}</span>
          </div>
        </div>

        {note.notes ? <p className="mt-6 whitespace-pre-line text-sm text-slate-600 dark:text-slate-400">{note.notes}</p> : null}
      </div>
    </div>
  );
}
