import { createClient } from "@/lib/supabase/server";
import { requireBookkeeper } from "@/lib/bookkeeping/access";
import { toIsoDate } from "@/lib/bookkeeping/period";
import { StatCard } from "@/components/bookkeeping/ui";
import { formatGBP, roundMoney } from "@/lib/format";
import { CreditNoteForm } from "./credit-note-form";
import { CreditNoteRow, type CreditNoteData } from "./credit-note-row";
import { CustomerCreditNoteForm } from "./customer-credit-note-form";
import Link from "next/link";

export default async function CreditNotesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const org = await requireBookkeeper();
  if (!org) return null;
  const { view } = await searchParams;
  const toggle = <ViewToggle current={view === "customers" ? "customers" : "suppliers"} />;
  if (view === "customers") return <CustomerCreditNotes orgId={org.orgId} toggle={toggle} />;

  const today = toIsoDate(new Date());
  const supabase = await createClient();
  const [{ data: notes }, { data: vendors }] = await Promise.all([
    supabase
      .from("credit_notes")
      .select("*, credit_note_lines(id, sort_order, description, qty, unit_price, net_amount, vat_rate, vat_amount)")
      .eq("org_id", org.orgId)
      .order("credit_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("vendors").select("id, name").eq("org_id", org.orgId).order("name"),
  ]);

  // Photos are stored privately; sign short-lived links at view time.
  const paths = (notes ?? []).map((n) => n.image_path).filter((p): p is string => !!p);
  const signed = paths.length ? await supabase.storage.from("receipts").createSignedUrls(paths, 3600) : { data: [] };
  const linkByPath = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));

  const rows: CreditNoteData[] = (notes ?? []).map((n) => ({
    id: n.id,
    supplierName: n.supplier_name,
    supplierVatNumber: n.supplier_vat_number,
    creditNoteNumber: n.credit_note_number,
    creditDate: n.credit_date,
    originalInvoiceRef: n.original_invoice_ref,
    accountReference: n.account_reference,
    reason: n.reason,
    notes: n.notes,
    status: n.status,
    settledOn: n.settled_on,
    net: n.net_total,
    vat: n.vat_total,
    gross: n.gross_total ?? roundMoney(n.net_total + n.vat_total),
    photoLink: n.image_path ? (linkByPath.get(n.image_path) ?? null) : null,
    lines: [...(n.credit_note_lines ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }));

  const open = rows.filter((r) => r.status === "open");
  const openTotal = roundMoney(open.reduce((s, r) => s + r.gross, 0));
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const thisYear = rows.filter((r) => r.creditDate >= yearStart);

  return (
    <div className="space-y-6">
      {toggle}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Still owed to you" value={formatGBP(openTotal)} hint={`${open.length} open credit note${open.length === 1 ? "" : "s"}`} tone={openTotal > 0 ? "warn" : undefined} />
        <StatCard label="Credits this year" value={formatGBP(roundMoney(thisYear.reduce((s, r) => s + r.gross, 0)))} hint={`${thisYear.length} credit note${thisYear.length === 1 ? "" : "s"}`} />
        <StatCard label="VAT on credits this year" value={formatGBP(roundMoney(thisYear.reduce((s, r) => s + r.vat, 0)))} hint="VAT you can no longer reclaim" />
      </div>

      <CreditNoteForm orgId={org.orgId} today={today} vendors={vendors ?? []} />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Supplier</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">VAT</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <CreditNoteRow key={r.id} row={r} today={today} />
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No credit notes yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ViewToggle({ current }: { current: "suppliers" | "customers" }) {
  return (
    <div className="flex gap-2">
      {[
        { key: "suppliers", label: "From suppliers", href: "/dashboard/bookkeeping/credit-notes" },
        { key: "customers", label: "To customers", href: "/dashboard/bookkeeping/credit-notes?view=customers" },
      ].map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            t.key === current
              ? "bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900"
              : "border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = { open: "Open", applied: "Taken off invoice", refunded: "Refunded" };

/** Credit notes the business has given its customers. */
async function CustomerCreditNotes({ orgId, toggle }: { orgId: string; toggle: React.ReactNode }) {
  const today = toIsoDate(new Date());
  const supabase = await createClient();
  const [{ data: notes }, { data: customers }, { data: invoices }] = await Promise.all([
    supabase
      .from("customer_credit_notes")
      .select("id, number, credit_date, reason, status, settled_on, net_total, vat_total, gross_total, customers(name), invoices(number)")
      .eq("org_id", orgId)
      .order("credit_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("customers").select("id, name").eq("org_id", orgId).order("name"),
    supabase.from("invoices").select("id, number, customer_id, issue_date, total").eq("org_id", orgId).neq("status", "draft").order("issue_date", { ascending: false }).limit(1000),
  ]);
  const rows = notes ?? [];
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const thisYear = rows.filter((n) => n.credit_date >= yearStart);
  const open = rows.filter((n) => n.status === "open");

  return (
    <div className="space-y-6">
      {toggle}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Open credits you owe customers" value={formatGBP(roundMoney(open.reduce((s, n) => s + (n.gross_total ?? 0), 0)))} hint={`${open.length} open`} tone={open.length ? "warn" : undefined} />
        <StatCard label="Credited this year" value={formatGBP(roundMoney(thisYear.reduce((s, n) => s + (n.gross_total ?? 0), 0)))} hint={`${thisYear.length} credit note${thisYear.length === 1 ? "" : "s"}`} />
        <StatCard label="VAT taken off sales this year" value={formatGBP(roundMoney(thisYear.reduce((s, n) => s + n.vat_total, 0)))} hint="Comes off Box 1 of the VAT return" />
      </div>

      <CustomerCreditNoteForm
        today={today}
        customers={customers ?? []}
        invoices={(invoices ?? []).map((i) => ({ id: i.id, number: i.number, customerId: i.customer_id, issueDate: i.issue_date, total: i.total }))}
      />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Credit note</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">VAT</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => {
              const customer = n.customers as unknown as { name: string } | null;
              const invoice = n.invoices as unknown as { number: string | null } | null;
              return (
                <tr key={n.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-400">{n.credit_date}</td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/bookkeeping/credit-notes/customer/${n.id}`} className="font-medium text-slate-900 hover:underline dark:text-slate-50">
                      {n.number} · {customer?.name ?? "—"}
                    </Link>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {invoice ? `Against ${invoice.number ?? "invoice"}` : "Not against an invoice"}
                      {n.reason ? ` · ${n.reason}` : ""}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        n.status === "open" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                      }`}
                    >
                      {STATUS_LABEL[n.status] ?? n.status}
                      {n.settled_on ? ` ${n.settled_on}` : ""}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600 dark:text-slate-400">{formatGBP(n.vat_total)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-50">{formatGBP(n.gross_total ?? 0)}</td>
                </tr>
              );
            })}
            {!rows.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No credit notes given to customers yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
