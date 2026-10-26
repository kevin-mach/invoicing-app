import Link from "next/link";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireBookkeeper } from "@/lib/bookkeeping/access";
import { fetchAll, getPurchaseSummaries } from "@/lib/bookkeeping/data";
import { invoiceVatFromLines, sixMonthDate, vatInUnpaid } from "@/lib/bookkeeping/bad-debts";
import { addDays } from "@/lib/bookkeeping/ageing";
import { toIsoDate } from "@/lib/bookkeeping/period";
import { StatCard } from "@/components/bookkeeping/ui";
import { formatGBP, roundMoney } from "@/lib/format";
import { AdjustButton, UndoAdjustment } from "./adjust-button";

type Adjustment = { id: string; kind: string; invoice_id: string | null; purchase_id: string | null; adjustment_date: string; amount: number; vat: number };

function Section({ title, hint, children, empty, count }: { title: string; hint: string; children: ReactNode; empty: string; count: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h3 className="font-semibold text-slate-900 dark:text-slate-50">{title}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">{hint}</p>
      </div>
      {count ? <ul className="divide-y divide-slate-100 dark:divide-slate-800">{children}</ul> : <p className="px-4 py-6 text-center text-sm text-slate-400">{empty}</p>}
    </div>
  );
}

function Row({ title, detail, amount, action }: { title: ReactNode; detail: ReactNode; amount: ReactNode; action: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
      <div className="min-w-0">
        <p className="font-medium text-slate-900 dark:text-slate-50">{title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{detail}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">{amount}</div>
        {action}
      </div>
    </li>
  );
}

export default async function BadDebtsPage() {
  const org = await requireBookkeeper();
  if (!org) return null;
  const today = toIsoDate(new Date());
  const supabase = await createClient();

  type InvoiceRow = { id: string; number: string | null; status: string; issue_date: string; due_date: string | null; total: number; customers: { name: string } | null; invoice_line_items: { vat_amount: number | null }[] };
  const [invoices, payments, { data: adjRows }, bills] = await Promise.all([
    fetchAll<InvoiceRow>((f, t) =>
      supabase
        .from("invoices")
        .select("id, number, status, issue_date, due_date, total, customers(name), invoice_line_items(vat_amount)")
        .eq("org_id", org.orgId)
        .neq("status", "draft")
        .order("id")
        .range(f, t) as unknown as PromiseLike<{ data: InvoiceRow[] | null; error: { message: string } | null }>
    ),
    fetchAll<{ invoice_id: string; amount: number; paid_on: string }>((f, t) =>
      supabase.from("invoice_payments").select("invoice_id, amount, paid_on").eq("org_id", org.orgId).order("id").range(f, t)
    ),
    supabase.from("vat_adjustments").select("id, kind, invoice_id, purchase_id, adjustment_date, amount, vat").eq("org_id", org.orgId).order("adjustment_date"),
    getPurchaseSummaries(org.orgId),
  ]);
  const adjustments: Adjustment[] = adjRows ?? [];
  const adjFor = (key: "invoice_id" | "purchase_id", id: string) => adjustments.filter((a) => a[key] === id);
  const paidOn = (invoiceId: string, after?: string) =>
    roundMoney(payments.filter((p) => p.invoice_id === invoiceId && (!after || p.paid_on > after)).reduce((s, p) => s + p.amount, 0));

  // ---- Customers who haven't paid ----
  const unpaid = invoices
    .map((i) => {
      const outstanding = i.status === "paid" ? 0 : roundMoney(Math.max(i.total - paidOn(i.id), 0));
      return { ...i, outstanding, eligible: sixMonthDate(i.due_date, i.issue_date), vat: vatInUnpaid(invoiceVatFromLines(i.invoice_line_items), i.total, outstanding), adj: adjFor("invoice_id", i.id) };
    })
    .filter((i) => i.vat > 0 && !i.adj.some((a) => a.kind === "bad_debt_relief"));
  const readyToClaim = unpaid.filter((i) => i.eligible <= today).sort((a, b) => a.eligible.localeCompare(b.eligible));
  const in90Days = addDays(today, 90);
  const comingUp = unpaid.filter((i) => i.eligible > today && i.eligible <= in90Days).sort((a, b) => a.eligible.localeCompare(b.eligible));
  const claimed = invoices
    .map((i) => ({ ...i, adj: adjFor("invoice_id", i.id) }))
    .filter((i) => i.adj.some((a) => a.kind === "bad_debt_relief"))
    .map((i) => {
      const relief = i.adj.find((a) => a.kind === "bad_debt_relief") as Adjustment;
      const repaid = i.adj.filter((a) => a.kind === "bad_debt_repaid");
      const paidSince = paidOn(i.id, relief.adjustment_date);
      const due = relief.amount > 0 ? roundMoney((relief.vat * Math.min(paidSince, relief.amount)) / relief.amount - repaid.reduce((s, a) => s + a.vat, 0)) : 0;
      return { ...i, relief, repaid, repayDue: due };
    });

  // ---- Bills the business hasn't paid ----
  const billRows = bills.map((b) => ({ ...b, eligible: sixMonthDate(b.dueDate, b.purchaseDate), adj: adjFor("purchase_id", b.id) }));
  const billsToRepay = billRows.filter((b) => !b.paidOn && b.vat > 0 && b.eligible <= today && !b.adj.some((a) => a.kind === "unpaid_bill_repay"));
  const billsRepaid = billRows.filter((b) => b.adj.some((a) => a.kind === "unpaid_bill_repay"));

  const claimable = roundMoney(readyToClaim.reduce((s, i) => s + i.vat, 0));
  const toPayBack = roundMoney(billsToRepay.reduce((s, b) => s + b.vat, 0) + claimed.reduce((s, i) => s + Math.max(0, i.repayDue), 0));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="VAT you can claim back" value={formatGBP(claimable)} tone={claimable > 0 ? "good" : undefined} hint={`${readyToClaim.length} invoice${readyToClaim.length === 1 ? "" : "s"} unpaid 6+ months`} />
        <StatCard label="VAT to pay back" value={formatGBP(toPayBack)} tone={toPayBack > 0 ? "warn" : undefined} hint="Bills unpaid 6+ months, or customers who paid after a claim" />
        <StatCard label="Coming up in 90 days" value={`${comingUp.length} invoice${comingUp.length === 1 ? "" : "s"}`} hint="Will qualify for bad debt relief if still unpaid" />
      </div>

      <Section
        title="Customers who haven't paid — claim the VAT back"
        hint="You paid HMRC the VAT on these invoices but the customer hasn't paid you, 6 months after the due date. Writing one off records the unpaid amount as a cost in Profit & loss and claims its VAT back."
        count={readyToClaim.length}
        empty="No invoices unpaid for 6 months after their due date."
      >
        {readyToClaim.map((i) => (
          <Row
            key={i.id}
            title={
              <Link href={`/dashboard/invoices/${i.id}`} className="hover:underline">
                {i.number ?? i.id.slice(0, 8)} · {i.customers?.name ?? "—"}
              </Link>
            }
            detail={`Issued ${i.issue_date} · could claim from ${i.eligible} · ${formatGBP(i.outstanding)} unpaid`}
            amount={<span className="font-medium text-green-700 dark:text-green-400">{formatGBP(i.vat)} VAT</span>}
            action={<AdjustButton action="claim" id={i.id} label="Write off & claim VAT" today={today} />}
          />
        ))}
      </Section>

      <Section
        title="Relief claimed"
        hint="If a customer pays after relief was claimed, the VAT on what they paid has to be paid back."
        count={claimed.length}
        empty="No relief claimed yet."
      >
        {claimed.map((i) => (
          <Row
            key={i.id}
            title={
              <Link href={`/dashboard/invoices/${i.id}`} className="hover:underline">
                {i.number ?? i.id.slice(0, 8)} · {i.customers?.name ?? "—"}
              </Link>
            }
            detail={
              <>
                Written off {formatGBP(roundMoney(i.relief.amount - i.relief.vat))} and {formatGBP(i.relief.vat)} VAT claimed on {i.relief.adjustment_date}
                {i.repaid.length ? ` · paid back ${formatGBP(i.repaid.reduce((s, a) => s + a.vat, 0))}` : ""}
                {i.repayDue > 0.005 ? <span className="text-amber-700 dark:text-amber-400"> · the customer has paid since — {formatGBP(i.repayDue)} to pay back</span> : null}
              </>
            }
            amount={null}
            action={
              i.repayDue > 0.005 ? (
                <AdjustButton action="repayRelief" id={i.id} label="Pay it back" today={today} />
              ) : (
                <UndoAdjustment id={(i.repaid.at(-1) ?? i.relief).id} />
              )
            }
          />
        ))}
      </Section>

      {comingUp.length ? (
        <Section title="Coming up" hint="These will qualify in the next 90 days if they're still unpaid — a good moment to chase." count={comingUp.length} empty="">
          {comingUp.map((i) => (
            <Row
              key={i.id}
              title={`${i.number ?? i.id.slice(0, 8)} · ${i.customers?.name ?? "—"}`}
              detail={`${formatGBP(i.outstanding)} unpaid · qualifies on ${i.eligible}`}
              amount={<span className="text-slate-600 dark:text-slate-400">{formatGBP(i.vat)} VAT</span>}
              action={null}
            />
          ))}
        </Section>
      ) : null}

      <Section
        title="Bills you haven't paid — pay the VAT back"
        hint="You reclaimed the VAT on these supplier bills, but they're still unpaid 6 months after they were due, so HMRC wants that VAT back. You can reclaim it again once you pay."
        count={billsToRepay.length}
        empty="No supplier bills unpaid 6 months after their due date."
      >
        {billsToRepay.map((b) => (
          <Row
            key={b.id}
            title={
              <Link href={`/dashboard/purchases/${b.id}`} className="hover:underline">
                {b.vendorName}
                {b.supplierRef ? ` · ${b.supplierRef}` : ""}
              </Link>
            }
            detail={`Bought ${b.purchaseDate} · applies from ${b.eligible} · ${formatGBP(b.gross)} unpaid`}
            amount={<span className="font-medium text-amber-700 dark:text-amber-400">{formatGBP(b.vat)} VAT</span>}
            action={<AdjustButton action="repayBill" id={b.id} label="Pay VAT back" today={today} />}
          />
        ))}
      </Section>

      {billsRepaid.length ? (
        <Section title="VAT paid back on bills" hint="Once a bill is paid, its VAT can be reclaimed again." count={billsRepaid.length} empty="">
          {billsRepaid.map((b) => {
            const repay = b.adj.find((a) => a.kind === "unpaid_bill_repay") as Adjustment;
            const reclaim = b.adj.find((a) => a.kind === "unpaid_bill_reclaim");
            return (
              <Row
                key={b.id}
                title={`${b.vendorName}${b.supplierRef ? ` · ${b.supplierRef}` : ""}`}
                detail={
                  <>
                    Paid back {formatGBP(repay.vat)} on {repay.adjustment_date}
                    {reclaim ? ` · reclaimed again on ${reclaim.adjustment_date}` : b.paidOn ? <span className="text-green-700 dark:text-green-400"> · bill paid {b.paidOn} — reclaim the VAT</span> : " · bill still unpaid"}
                  </>
                }
                amount={null}
                action={b.paidOn && !reclaim ? <AdjustButton action="reclaimBill" id={b.id} label="Reclaim VAT" today={today} /> : <UndoAdjustment id={(reclaim ?? repay).id} />}
              />
            );
          })}
        </Section>
      ) : null}

      <p className="text-sm text-slate-500 dark:text-slate-400">
        Follows HMRC VAT Notice 700/18: the 6 months run from the invoice or bill&apos;s due date (30 days after it if no due date is set). Each claim or repayment goes into the VAT
        return for the period it&apos;s dated in. Keep a record of writing each bad debt off in your accounts — HMRC can ask for it.
      </p>
    </div>
  );
}
