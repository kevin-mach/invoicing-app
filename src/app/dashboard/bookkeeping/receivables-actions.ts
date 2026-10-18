"use server";

import { PAYMENT_METHODS } from "@/lib/bookkeeping/categories";
import { bookkeepingCtx, ISO_DATE, NOT_ALLOWED, OK, refreshBookkeeping, syncInvoiceStatus, type ActionResult } from "@/lib/bookkeeping/server-actions";
import { roundMoney } from "@/lib/format";

export async function recordInvoicePayment(
  invoiceId: string,
  input: { amount: number; paidOn: string; method: string; reference: string }
): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  const { org, supabase } = c;

  const amount = roundMoney(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter an amount greater than zero." };
  if (!ISO_DATE.test(input.paidOn)) return { error: "Enter the payment date." };
  if (!(PAYMENT_METHODS as readonly string[]).includes(input.method)) return { error: "Pick a payment method." };

  const { data: invoice } = await supabase.from("invoices").select("id, status").eq("id", invoiceId).eq("org_id", org.orgId).maybeSingle();
  if (!invoice) return { error: "Invoice not found." };
  if (invoice.status === "draft") return { error: "Send the invoice before recording a payment." };

  const { error } = await supabase.from("invoice_payments").insert({
    org_id: org.orgId,
    invoice_id: invoiceId,
    amount,
    paid_on: input.paidOn,
    method: input.method,
    reference: input.reference.trim().slice(0, 120) || null,
  });
  if (error) return { error: error.message };

  await syncInvoiceStatus(supabase, org.orgId, invoiceId);
  refreshBookkeeping();
  return OK;
}

export async function deleteInvoicePayment(paymentId: string): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  const { org, supabase } = c;

  const { data: payment } = await supabase
    .from("invoice_payments")
    .select("id, invoice_id, bank_transaction_id")
    .eq("id", paymentId)
    .eq("org_id", org.orgId)
    .maybeSingle();
  if (!payment) return { error: "Payment not found." };

  await supabase.from("invoice_payments").delete().eq("id", payment.id);
  if (payment.bank_transaction_id) {
    await supabase.from("bank_transactions").update({ status: "unreviewed", matched_type: null, matched_id: null, note: null }).eq("id", payment.bank_transaction_id);
  }
  await syncInvoiceStatus(supabase, org.orgId, payment.invoice_id);
  refreshBookkeeping();
  return OK;
}
