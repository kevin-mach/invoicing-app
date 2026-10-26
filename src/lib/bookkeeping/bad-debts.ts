import { createClient } from "@/lib/supabase/server";
import { roundMoney } from "@/lib/format";
import { dueDateFor } from "./ageing";

/** HMRC's 6-month VAT rules (VAT Notice 700/18):
 * - bad debt relief: VAT you paid HMRC on an invoice a customer still hasn't paid 6 months after it
 *   was due (and that you've written off) can be claimed back — Box 4. If they pay later, that VAT
 *   is paid back — Box 1.
 * - unpaid bills: VAT you reclaimed on a supplier bill you still haven't paid 6 months after it was
 *   due must be paid back — taken off Box 4 — and can be reclaimed again once it's paid. */

export const SIX_MONTHS = 6;

export type VatAdjustmentKind = "bad_debt_relief" | "bad_debt_repaid" | "unpaid_bill_repay" | "unpaid_bill_reclaim";

/** The same day N months later (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** The first day the 6-month rule applies to an invoice or bill. */
export function sixMonthDate(dueDate: string | null, baseDate: string): string {
  return addMonths(dueDateFor(dueDate, baseDate), SIX_MONTHS);
}

/** The VAT in what's still unpaid on an invoice: its VAT × the share of it still owed. */
export function vatInUnpaid(invoiceVat: number, invoiceTotal: number, outstanding: number): number {
  if (invoiceTotal <= 0 || invoiceVat <= 0 || outstanding <= 0) return 0;
  return roundMoney((invoiceVat * Math.min(outstanding, invoiceTotal)) / invoiceTotal);
}

/** The VAT charged on an invoice: the sum of its lines' VAT. (The invoice's own `tax` field is a
 * separate manual extra-tax box, usually £0, and is not VAT.) */
export function invoiceVatFromLines(lines: { vat_amount: number | null }[] | null | undefined): number {
  return roundMoney((lines ?? []).reduce((s, l) => s + (l.vat_amount ?? 0), 0));
}

/** How a period's 6-month adjustments change the VAT return. */
export type VatAdjustmentTotals = { box1: number; box4: number; rows: { kind: VatAdjustmentKind; date: string; vat: number; label: string }[] };

const LABEL: Record<VatAdjustmentKind, string> = {
  bad_debt_relief: "Bad debt relief claimed",
  bad_debt_repaid: "Bad debt relief paid back (customer paid)",
  unpaid_bill_repay: "VAT paid back on a bill unpaid 6 months",
  unpaid_bill_reclaim: "VAT reclaimed again on a bill now paid",
};

export async function getVatAdjustments(orgId: string, from: string, to: string): Promise<VatAdjustmentTotals> {
  const supabase = await createClient();
  const { data } = await supabase.from("vat_adjustments").select("kind, adjustment_date, vat").eq("org_id", orgId).gte("adjustment_date", from).lte("adjustment_date", to);
  const rows = (data ?? []).map((a) => ({ kind: a.kind as VatAdjustmentKind, date: a.adjustment_date, vat: a.vat, label: LABEL[a.kind as VatAdjustmentKind] ?? a.kind }));
  const sum = (kind: VatAdjustmentKind) => rows.filter((r) => r.kind === kind).reduce((s, r) => s + r.vat, 0);
  return {
    box1: roundMoney(sum("bad_debt_repaid")),
    box4: roundMoney(sum("bad_debt_relief") + sum("unpaid_bill_reclaim") - sum("unpaid_bill_repay")),
    rows,
  };
}

/** Bad debts written off in a period, for the P&L: when relief is claimed, the unpaid amount less its
 * VAT is a cost; anything the customer pays afterwards (less the VAT paid back) is recovered. */
export async function getBadDebtWriteOffs(orgId: string, from: string, to: string): Promise<{ date: string; net: number }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vat_adjustments")
    .select("kind, adjustment_date, amount, vat")
    .eq("org_id", orgId)
    .in("kind", ["bad_debt_relief", "bad_debt_repaid"])
    .gte("adjustment_date", from)
    .lte("adjustment_date", to);
  return (data ?? []).map((a) => ({ date: a.adjustment_date, net: roundMoney((a.kind === "bad_debt_relief" ? 1 : -1) * (a.amount - a.vat)) }));
}
