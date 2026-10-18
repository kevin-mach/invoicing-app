"use server";

import { VAT_RATES } from "@/lib/bookkeeping/categories";
import { bookkeepingCtx, ISO_DATE, NOT_ALLOWED, OK, refreshBookkeeping, unmatchBankLinesFor, type ActionResult } from "@/lib/bookkeeping/server-actions";

export async function markPurchasePaid(purchaseId: string, paidOn: string): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  if (!ISO_DATE.test(paidOn)) return { error: "Enter the payment date." };
  const { error } = await c.supabase.from("purchases").update({ paid_on: paidOn }).eq("id", purchaseId).eq("org_id", c.org.orgId);
  if (error) return { error: error.message };
  refreshBookkeeping();
  return OK;
}

export async function markPurchaseUnpaid(purchaseId: string): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  const { error } = await c.supabase.from("purchases").update({ paid_on: null }).eq("id", purchaseId).eq("org_id", c.org.orgId);
  if (error) return { error: error.message };
  await unmatchBankLinesFor(c.supabase, c.org.orgId, "purchase", purchaseId);
  refreshBookkeeping();
  return OK;
}

/** Sets a bill's supplier reference and due date, and optionally one VAT rate for all its lines. */
export async function updateBillDetails(
  purchaseId: string,
  input: { supplierRef: string; dueDate: string; vatRate: number | null }
): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  const { org, supabase } = c;

  if (input.dueDate && !ISO_DATE.test(input.dueDate)) return { error: "Invalid due date." };
  if (input.vatRate !== null && !(VAT_RATES as readonly number[]).includes(input.vatRate)) {
    return { error: "Invalid VAT rate." };
  }

  const { error } = await supabase
    .from("purchases")
    .update({ supplier_ref: input.supplierRef.trim() || null, due_date: input.dueDate || null })
    .eq("id", purchaseId)
    .eq("org_id", org.orgId);
  if (error) {
    return { error: error.code === "23505" ? "That supplier invoice number is already recorded for this supplier." : error.message };
  }

  if (input.vatRate !== null) {
    const { error: vatError } = await supabase.from("purchase_line_items").update({ vat_rate: input.vatRate }).eq("purchase_id", purchaseId);
    if (vatError) return { error: vatError.message };
  }
  refreshBookkeeping();
  return OK;
}
