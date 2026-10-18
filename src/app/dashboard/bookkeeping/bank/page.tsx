import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireBookkeeper } from "@/lib/bookkeeping/access";
import { getBankTransactions, getInvoiceSummaries, getPurchaseSummaries } from "@/lib/bookkeeping/data";
import { payeeKey } from "@/lib/bookkeeping/bank-csv";
import { formatGBP } from "@/lib/format";
import { PeriodFilter } from "@/components/bookkeeping/period-filter";
import { BankImport } from "./bank-import";
import { BankRow, type BankOption, type BankSuggestion } from "./bank-row";

const STATUSES = ["unreviewed", "matched", "ignored", "all"] as const;
type StatusFilter = (typeof STATUSES)[number];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ROWS = 300;

export default async function BankPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; status?: string }>;
}) {
  const org = await requireBookkeeper();
  if (!org) return null;

  const params = await searchParams;
  const status: StatusFilter = (STATUSES as readonly string[]).includes(params.status ?? "")
    ? (params.status as StatusFilter)
    : "unreviewed";
  const from = params.from && ISO_DATE.test(params.from) ? params.from : "";
  const to = params.to && ISO_DATE.test(params.to) ? params.to : "";
  const supabase = await createClient();

  const [txns, openInvoices, unpaidBills, unreviewedCount, matchedCount, ignoredCount, history] = await Promise.all([
    getBankTransactions(org.orgId, { from: from || undefined, to: to || undefined, status: status === "all" ? undefined : status }),
    getInvoiceSummaries(org.orgId, { statuses: ["sent", "overdue"] }),
    getPurchaseSummaries(org.orgId, { unpaidOnly: true }),
    supabase.from("bank_transactions").select("id", { count: "exact", head: true }).eq("org_id", org.orgId).eq("status", "unreviewed"),
    supabase.from("bank_transactions").select("id", { count: "exact", head: true }).eq("org_id", org.orgId).eq("status", "matched"),
    supabase.from("bank_transactions").select("id", { count: "exact", head: true }).eq("org_id", org.orgId).eq("status", "ignored"),
    categoryHistory(org.orgId),
  ]);

  const counts: Record<StatusFilter, number> = {
    unreviewed: unreviewedCount.count ?? 0,
    matched: matchedCount.count ?? 0,
    ignored: ignoredCount.count ?? 0,
    all: (unreviewedCount.count ?? 0) + (matchedCount.count ?? 0) + (ignoredCount.count ?? 0),
  };

  const invoicesOpen = openInvoices.filter((i) => i.outstanding > 0);
  const invoiceOptions: BankOption[] = invoicesOpen.slice(0, 200).map((i) => ({
    id: i.id,
    label: `${i.number ?? i.id.slice(0, 8)} · ${i.customerName} · ${formatGBP(i.outstanding)}`,
  }));
  const purchaseOptions: BankOption[] = unpaidBills.slice(0, 200).map((p) => ({
    id: p.id,
    label: `${p.vendorName}${p.supplierRef ? ` (${p.supplierRef})` : ""} · ${p.purchaseDate} · ${formatGBP(p.gross)}`,
  }));

  const shown = txns.slice(0, MAX_ROWS);

  const suggest = (amount: number): BankSuggestion[] => {
    if (amount > 0) {
      return invoicesOpen
        .filter((i) => Math.abs(i.outstanding - amount) < 0.01 || Math.abs(i.total - amount) < 0.01)
        .slice(0, 3)
        .map((i) => ({ kind: "invoice", id: i.id, label: `${i.number ?? i.id.slice(0, 8)} (${i.customerName})` }));
    }
    return unpaidBills
      .filter((p) => Math.abs(p.gross - Math.abs(amount)) < 0.01)
      .slice(0, 3)
      .map((p) => ({
        kind: "purchase",
        id: p.id,
        label: `${p.vendorName} bill of ${p.purchaseDate} (${formatGBP(p.gross)})`,
      }));
  };

  const matchedLabels = await labelMatches(
    shown.filter((t) => t.matched_id && t.matched_type).map((t) => ({ type: t.matched_type!, id: t.matched_id! }))
  );

  const tabHref = (s: StatusFilter) =>
    `/dashboard/bookkeeping/bank?status=${s}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`;

  return (
    <div className="space-y-4">
      <BankImport />

      <PeriodFilter basePath="/dashboard/bookkeeping/bank" from={from} to={to} extra={{ status }} />

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={tabHref(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
              status === s
                ? "bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900"
                : "border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {s} ({counts[s]})
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((t) => (
              <BankRow
                key={t.id}
                txn={{
                  id: t.id,
                  txn_date: t.txn_date,
                  description: t.description,
                  amount: t.amount,
                  status: t.status,
                  note: t.note,
                  matchedLabel: t.matched_id ? (matchedLabels.get(t.matched_id) ?? null) : null,
                }}
                suggestions={t.status === "unreviewed" ? suggest(t.amount) : []}
                categorySuggestion={t.amount < 0 ? (history.get(payeeKey(t.description)) ?? "") : ""}
                invoiceOptions={invoiceOptions}
                purchaseOptions={purchaseOptions}
              />
            ))}
            {!shown.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  {status === "unreviewed" ? "Nothing to review. Import a statement to get started." : "No transactions."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {txns.length > MAX_ROWS ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Showing the latest {MAX_ROWS} of {txns.length}. Narrow the dates to see the rest.
        </p>
      ) : null}
    </div>
  );
}

/** payee → category the bookkeeper picked last time, so repeat suppliers pre-fill. */
async function categoryHistory(orgId: string): Promise<Map<string, string>> {
  const supabase = await createClient();
  const { data: txns } = await supabase
    .from("bank_transactions")
    .select("description, matched_id")
    .eq("org_id", orgId)
    .eq("matched_type", "expense")
    .order("txn_date", { ascending: false })
    .limit(500);
  const ids = (txns ?? []).map((t) => t.matched_id).filter((id): id is string => !!id);
  if (!ids.length) return new Map();

  const { data: expenses } = await supabase.from("expenses").select("id, category").in("id", ids);
  const categoryById = new Map((expenses ?? []).map((e) => [e.id, e.category]));

  const map = new Map<string, string>();
  for (const t of txns ?? []) {
    const key = payeeKey(t.description);
    const category = t.matched_id ? categoryById.get(t.matched_id) : undefined;
    if (key && category && !map.has(key)) map.set(key, category);
  }
  return map;
}

async function labelMatches(refs: { type: string; id: string }[]): Promise<Map<string, string>> {
  const supabase = await createClient();
  const byType = (type: string) => refs.filter((r) => r.type === type).map((r) => r.id);
  const labels = new Map<string, string>();

  const [invoices, purchases, expenses, cashUps, payRuns] = await Promise.all([
    byType("invoice").length
      ? supabase.from("invoices").select("id, number, customers(name)").in("id", byType("invoice"))
      : Promise.resolve({ data: [] }),
    byType("purchase").length
      ? supabase.from("purchases").select("id, supplier_ref, vendors(name)").in("id", byType("purchase"))
      : Promise.resolve({ data: [] }),
    byType("expense").length
      ? supabase.from("expenses").select("id, category, payee").in("id", byType("expense"))
      : Promise.resolve({ data: [] }),
    byType("cashup").length
      ? supabase.from("cash_ups").select("id, till, cashup_date").in("id", byType("cashup"))
      : Promise.resolve({ data: [] }),
    byType("payroll").length
      ? supabase.from("pay_runs").select("id, pay_date").in("id", byType("payroll"))
      : Promise.resolve({ data: [] }),
  ]);

  for (const i of (invoices.data ?? []) as unknown as { id: string; number: string | null; customers: { name: string } | null }[]) {
    labels.set(i.id, `Invoice ${i.number ?? i.id.slice(0, 8)} · ${i.customers?.name ?? "—"}`);
  }
  for (const p of (purchases.data ?? []) as unknown as { id: string; supplier_ref: string | null; vendors: { name: string } | null }[]) {
    labels.set(p.id, `Bill · ${p.vendors?.name ?? "—"}${p.supplier_ref ? ` (${p.supplier_ref})` : ""}`);
  }
  for (const e of (expenses.data ?? []) as unknown as { id: string; category: string; payee: string }[]) {
    labels.set(e.id, `Expense · ${e.category}`);
  }
  for (const c of (cashUps.data ?? []) as unknown as { id: string; till: string; cashup_date: string }[]) {
    labels.set(c.id, `Cash-up · ${c.till} · ${c.cashup_date}`);
  }
  for (const r of (payRuns.data ?? []) as unknown as { id: string; pay_date: string }[]) {
    labels.set(r.id, `Payroll · pay run of ${r.pay_date}`);
  }
  return labels;
}
