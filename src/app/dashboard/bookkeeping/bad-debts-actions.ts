"use server";

import { bookkeepingCtx, ISO_DATE, NOT_ALLOWED, OK, refreshBookkeeping, type ActionResult } from "@/lib/bookkeeping/server-actions";
import { invoiceVatFromLines, sixMonthDate, vatInUnpaid } from "@/lib/bookkeeping/bad-debts";
import { roundMoney } from "@/lib/format";

type Ctx = NonNullable<Awaited<ReturnType<typeof bookkeepingCtx>>>;

async function adjustmentsFor(c: Ctx, column: "invoice_id" | "purchase_id", id: string) {
  const { data } = await c.supabase.from("vat_adjustments").select("id, kind, adjustment_date, amount, vat").eq("org_id", c.org.orgId).eq(column, id);
  return data ?? [];
}

/** Claims bad debt relief on an invoice the customer hasn't paid. The VAT is worked out here from the
 * invoice, never taken from the browser. */
export async function claimBadDebtRelief(invoiceId: string, date: string): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  if (!ISO_DATE.test(date)) return { error: "Enter the date." };
  const { data: invoice } = await c.supabase.from("invoices").select("id, status, issue_date, due_date, total, invoice_line_items(vat_amount)").eq("id", invoiceId).eq("org_id", c.org.orgId).maybeSingle();
  if (!invoice || invoice.status === "draft") return { error: "Invoice not found." };
  const eligible = sixMonthDate(invoice.due_date, invoice.issue_date);
  if (date < eligible) return { error: `Relief can only be claimed from ${eligible} — 6 months after the invoice was due.` };
  if ((await adjustmentsFor(c, "invoice_id", invoice.id)).some((a) => a.kind === "bad_debt_relief")) return { error: "Relief has already been claimed on this invoice." };

  const { data: payments } = await c.supabase.from("invoice_payments").select("amount").eq("invoice_id", invoice.id).lte("paid_on", date);
  const outstanding = roundMoney(invoice.total - (payments ?? []).reduce((s, p) => s + p.amount, 0));
  const vat = vatInUnpaid(invoiceVatFromLines(invoice.invoice_line_items), invoice.total, outstanding);
  if (vat <= 0) return { error: "There's no unpaid VAT on this invoice to claim." };

  const { error } = await c.supabase.from("vat_adjustments").insert({ org_id: c.org.orgId, kind: "bad_debt_relief", invoice_id: invoice.id, adjustment_date: date, amount: outstanding, vat });
  if (error) return { error: error.message };
  refreshBookkeeping();
  return OK;
}

/** The customer has paid (some of) an invoice relief was claimed on: pays back that share of the relief. */
export async function repayBadDebtRelief(invoiceId: string, date: string): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  if (!ISO_DATE.test(date)) return { error: "Enter the date." };
  const adj = await adjustmentsFor(c, "invoice_id", invoiceId);
  const relief = adj.find((a) => a.kind === "bad_debt_relief");
  if (!relief) return { error: "No relief was claimed on this invoice." };
  const alreadyRepaid = adj.filter((a) => a.kind === "bad_debt_repaid").reduce((s, a) => s + a.vat, 0);

  const { data: payments } = await c.supabase.from("invoice_payments").select("amount").eq("invoice_id", invoiceId).gt("paid_on", relief.adjustment_date);
  const paidSince = (payments ?? []).reduce((s, p) => s + p.amount, 0);
  const owed = relief.amount > 0 ? roundMoney((relief.vat * Math.min(paidSince, relief.amount)) / relief.amount - alreadyRepaid) : 0;
  if (owed <= 0.005) return { error: "Nothing has been paid since the relief was claimed." };

  const { error } = await c.supabase.from("vat_adjustments").insert({ org_id: c.org.orgId, kind: "bad_debt_repaid", invoice_id: invoiceId, adjustment_date: date, amount: roundMoney(paidSince), vat: owed });
  if (error) return { error: error.message };
  refreshBookkeeping();
  return OK;
}

/** Pays back the VAT reclaimed on a supplier bill still unpaid 6 months after it was due. */
export async function repayUnpaidBillVat(purchaseId: string, date: string): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  if (!ISO_DATE.test(date)) return { error: "Enter the date." };
  const { data: bill } = await c.supabase.from("purchases").select("id, purchase_date, due_date, paid_on, purchase_line_items(qty, unit_cost, line_total, vat_amount)").eq("id", purchaseId).eq("org_id", c.org.orgId).maybeSingle();
  if (!bill) return { error: "Bill not found." };
  if (bill.paid_on) return { error: "This bill has been paid, so there's nothing to pay back." };
  const eligible = sixMonthDate(bill.due_date, bill.purchase_date);
  if (date < eligible) return { error: `This only applies from ${eligible} — 6 months after the bill was due.` };
  if ((await adjustmentsFor(c, "purchase_id", bill.id)).some((a) => a.kind === "unpaid_bill_repay")) return { error: "The VAT on this bill has already been paid back." };

  const lines = (bill.purchase_line_items ?? []) as { qty: number; unit_cost: number; line_total: number | null; vat_amount: number | null }[];
  const vat = roundMoney(lines.reduce((s, l) => s + (l.vat_amount ?? 0), 0));
  const net = roundMoney(lines.reduce((s, l) => s + (l.line_total ?? l.qty * l.unit_cost), 0));
  if (vat <= 0) return { error: "There's no VAT on this bill." };

  const { error } = await c.supabase.from("vat_adjustments").insert({ org_id: c.org.orgId, kind: "unpaid_bill_repay", purchase_id: bill.id, adjustment_date: date, amount: roundMoney(net + vat), vat });
  if (error) return { error: error.message };
  refreshBookkeeping();
  return OK;
}

/** A bill whose VAT was paid back has now been paid: reclaims that VAT again. */
export async function reclaimPaidBillVat(purchaseId: string, date: string): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  if (!ISO_DATE.test(date)) return { error: "Enter the date." };
  const { data: bill } = await c.supabase.from("purchases").select("id, paid_on").eq("id", purchaseId).eq("org_id", c.org.orgId).maybeSingle();
  if (!bill) return { error: "Bill not found." };
  if (!bill.paid_on) return { error: "Mark the bill paid (under Payables) first." };
  const adj = await adjustmentsFor(c, "purchase_id", bill.id);
  const repay = adj.find((a) => a.kind === "unpaid_bill_repay");
  if (!repay) return { error: "The VAT on this bill wasn't paid back." };
  if (adj.some((a) => a.kind === "unpaid_bill_reclaim")) return { error: "It has already been reclaimed." };

  const { error } = await c.supabase.from("vat_adjustments").insert({ org_id: c.org.orgId, kind: "unpaid_bill_reclaim", purchase_id: bill.id, adjustment_date: date, amount: repay.amount, vat: repay.vat });
  if (error) return { error: error.message };
  refreshBookkeeping();
  return OK;
}

/** Undoes one adjustment. A claim with a later step on top (paid back / reclaimed) can't be undone
 * until that later step is. */
export async function undoVatAdjustment(id: string): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  const { data: a } = await c.supabase.from("vat_adjustments").select("id, kind, invoice_id, purchase_id").eq("id", id).eq("org_id", c.org.orgId).maybeSingle();
  if (!a) return { error: "Not found." };
  const siblings = a.invoice_id ? await adjustmentsFor(c, "invoice_id", a.invoice_id) : await adjustmentsFor(c, "purchase_id", a.purchase_id as string);
  const later = a.kind === "bad_debt_relief" ? "bad_debt_repaid" : a.kind === "unpaid_bill_repay" ? "unpaid_bill_reclaim" : null;
  if (later && siblings.some((s) => s.kind === later)) return { error: "Undo the later step first." };
  const { error } = await c.supabase.from("vat_adjustments").delete().eq("id", a.id);
  if (error) return { error: error.message };
  refreshBookkeeping();
  return OK;
}
