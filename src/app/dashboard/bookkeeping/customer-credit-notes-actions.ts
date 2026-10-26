"use server";

import { VAT_RATES } from "@/lib/bookkeeping/categories";
import { bookkeepingCtx, ISO_DATE, NOT_ALLOWED, OK, refreshBookkeeping, syncInvoiceStatus, type ActionResult } from "@/lib/bookkeeping/server-actions";
import { roundMoney } from "@/lib/format";
import { revalidatePath } from "next/cache";

export type CustomerCreditLineInput = { description: string; qty: number; unitPrice: number; vatRate: number };

/** The lines of an invoice, to copy onto a credit note against it. */
export async function getInvoiceLinesForCredit(invoiceId: string): Promise<{ error: string | null; lines?: CustomerCreditLineInput[] }> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  const { data: invoice } = await c.supabase.from("invoices").select("id").eq("id", invoiceId).eq("org_id", c.org.orgId).maybeSingle();
  if (!invoice) return { error: "Invoice not found." };
  const { data } = await c.supabase.from("invoice_line_items").select("description, qty, unit_price, vat_rate, sort_order").eq("invoice_id", invoiceId).order("sort_order");
  return { error: null, lines: (data ?? []).map((l) => ({ description: l.description, qty: l.qty, unitPrice: l.unit_price, vatRate: l.vat_rate })) };
}

/** The next credit note number for an org: CN-0001, CN-0002… */
async function nextNumber(c: NonNullable<Awaited<ReturnType<typeof bookkeepingCtx>>>): Promise<string> {
  const { data } = await c.supabase.from("customer_credit_notes").select("number").eq("org_id", c.org.orgId).like("number", "CN-%");
  const max = Math.max(0, ...(data ?? []).map((r) => Number(r.number.slice(3)) || 0));
  return `CN-${String(max + 1).padStart(4, "0")}`;
}

/** Raises a credit note to a customer. Its VAT comes off the VAT due on sales for the period it's dated in. */
export async function createCustomerCreditNote(input: {
  customerId: string;
  invoiceId: string | null;
  date: string;
  reason: string;
  notes: string;
  lines: CustomerCreditLineInput[];
}): Promise<ActionResult & { id?: string }> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  const { org, supabase } = c;

  if (!ISO_DATE.test(input.date)) return { error: "Enter the credit note date." };
  const { data: customer } = await supabase.from("customers").select("id").eq("id", input.customerId).eq("org_id", org.orgId).maybeSingle();
  if (!customer) return { error: "Pick the customer." };
  if (input.invoiceId) {
    const { data: invoice } = await supabase.from("invoices").select("id, customer_id, status").eq("id", input.invoiceId).eq("org_id", org.orgId).maybeSingle();
    if (!invoice || invoice.customer_id !== customer.id) return { error: "That invoice isn't this customer's." };
    if (invoice.status === "draft") return { error: "That invoice is still a draft — edit it instead of crediting it." };
  }
  if (!Array.isArray(input.lines) || !input.lines.length || input.lines.length > 60) return { error: "Add between 1 and 60 lines." };

  const lines = [];
  for (const l of input.lines) {
    const description = String(l.description ?? "").trim().slice(0, 200);
    const qty = Number(l.qty);
    const unitPrice = roundMoney(Math.abs(Number(l.unitPrice)));
    const vatRate = Number(l.vatRate);
    if (!description) return { error: "Every line needs a description." };
    if (!Number.isFinite(qty) || qty <= 0) return { error: `"${description}" needs a quantity above zero.` };
    if (!Number.isFinite(unitPrice)) return { error: `"${description}" has an invalid price.` };
    if (!(VAT_RATES as readonly number[]).includes(vatRate)) return { error: `"${description}" has an invalid VAT rate.` };
    const net = roundMoney(qty * unitPrice);
    lines.push({ description, qty, unitPrice, vatRate, net, vat: roundMoney((net * vatRate) / 100) });
  }
  const net = roundMoney(lines.reduce((s, l) => s + l.net, 0));
  const vat = roundMoney(lines.reduce((s, l) => s + l.vat, 0));
  if (net <= 0) return { error: "The credit note needs an amount." };

  // Two people saving at once could pick the same number; the unique index catches it, so try again.
  let note: { id: string } | null = null;
  for (let attempt = 0; attempt < 3 && !note; attempt++) {
    const { data, error } = await supabase
      .from("customer_credit_notes")
      .insert({
        org_id: org.orgId,
        customer_id: customer.id,
        invoice_id: input.invoiceId || null,
        number: await nextNumber(c),
        credit_date: input.date,
        reason: String(input.reason ?? "").trim().slice(0, 300) || null,
        notes: String(input.notes ?? "").trim().slice(0, 1000) || null,
        net_total: net,
        vat_total: vat,
      })
      .select("id")
      .single();
    if (data) note = data;
    else if (error?.code !== "23505") return { error: error?.message ?? "Couldn't save the credit note." };
  }
  if (!note) return { error: "Couldn't number the credit note — try again." };

  const { error: lineError } = await supabase.from("customer_credit_note_lines").insert(
    lines.map((l, i) => ({
      credit_note_id: note.id,
      sort_order: i,
      description: l.description,
      qty: l.qty,
      unit_price: l.unitPrice,
      net_amount: l.net,
      vat_rate: l.vatRate,
      vat_amount: l.vat,
    }))
  );
  if (lineError) {
    await supabase.from("customer_credit_notes").delete().eq("id", note.id);
    return { error: lineError.message };
  }
  refreshBookkeeping();
  return { error: null, id: note.id };
}

/** Takes the credit off the invoice it's against, as a payment of the credit amount. */
export async function applyCustomerCreditNote(id: string, date: string): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  const { org, supabase } = c;
  if (!ISO_DATE.test(date)) return { error: "Enter the date." };

  const { data: note } = await supabase.from("customer_credit_notes").select("id, number, invoice_id, status, net_total, vat_total").eq("id", id).eq("org_id", org.orgId).maybeSingle();
  if (!note) return { error: "Credit note not found." };
  if (note.status !== "open") return { error: "This credit note has already been settled." };
  if (!note.invoice_id) return { error: "This credit note isn't against an invoice — mark it refunded instead." };

  const { data: invoice } = await supabase.from("invoices").select("id, total, vat_on_top").eq("id", note.invoice_id).eq("org_id", org.orgId).maybeSingle();
  if (!invoice) return { error: "The invoice it's against can't be found." };
  const { data: payments } = await supabase.from("invoice_payments").select("amount").eq("invoice_id", invoice.id);
  const outstanding = roundMoney(invoice.total - (payments ?? []).reduce((s, p) => s + p.amount, 0));
  // An invoice that doesn't add VAT to its total is credited the same way.
  const amount = roundMoney(invoice.vat_on_top ? note.net_total + note.vat_total : note.net_total);
  if (amount > outstanding + 0.01) {
    return { error: `The credit (£${amount.toFixed(2)}) is more than the invoice still owes (£${Math.max(0, outstanding).toFixed(2)}). Refund it instead, or reduce it.` };
  }

  const { error } = await supabase.from("invoice_payments").insert({
    org_id: org.orgId,
    invoice_id: invoice.id,
    amount,
    paid_on: date,
    method: "other",
    reference: `Credit note ${note.number}`,
    customer_credit_note_id: note.id,
  });
  if (error) return { error: error.message };
  await supabase.from("customer_credit_notes").update({ status: "applied", settled_on: date }).eq("id", note.id);
  await syncInvoiceStatus(supabase, org.orgId, invoice.id);
  refreshBookkeeping();
  revalidatePath("/dashboard/invoices", "layout");
  return OK;
}

export async function refundCustomerCreditNote(id: string, date: string): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  if (!ISO_DATE.test(date)) return { error: "Enter the date." };
  const { error } = await c.supabase.from("customer_credit_notes").update({ status: "refunded", settled_on: date }).eq("id", id).eq("org_id", c.org.orgId).eq("status", "open");
  if (error) return { error: error.message };
  refreshBookkeeping();
  return OK;
}

/** Puts a settled credit note back to open, taking it off its invoice again if it was applied. */
export async function reopenCustomerCreditNote(id: string): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  const { org, supabase } = c;
  const { data: note } = await supabase.from("customer_credit_notes").select("id, invoice_id").eq("id", id).eq("org_id", org.orgId).maybeSingle();
  if (!note) return { error: "Credit note not found." };
  await supabase.from("invoice_payments").delete().eq("customer_credit_note_id", note.id);
  const { error } = await supabase.from("customer_credit_notes").update({ status: "open", settled_on: null }).eq("id", note.id);
  if (error) return { error: error.message };
  if (note.invoice_id) await syncInvoiceStatus(supabase, org.orgId, note.invoice_id);
  refreshBookkeeping();
  revalidatePath("/dashboard/invoices", "layout");
  return OK;
}

export async function deleteCustomerCreditNote(id: string): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  const { org, supabase } = c;
  const { data: note } = await supabase.from("customer_credit_notes").select("id, invoice_id").eq("id", id).eq("org_id", org.orgId).maybeSingle();
  if (!note) return { error: "Credit note not found." };
  // Its payment against the invoice goes with it (cascade).
  const { error } = await supabase.from("customer_credit_notes").delete().eq("id", note.id);
  if (error) return { error: error.message };
  if (note.invoice_id) await syncInvoiceStatus(supabase, org.orgId, note.invoice_id);
  refreshBookkeeping();
  revalidatePath("/dashboard/invoices", "layout");
  return OK;
}
