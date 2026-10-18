"use server";

import { EXPENSE_CATEGORIES, PAYMENT_METHODS, VAT_RATES } from "@/lib/bookkeeping/categories";
import { bookkeepingCtx, ISO_DATE, NOT_ALLOWED, OK, refreshBookkeeping, splitGross, type ActionResult } from "@/lib/bookkeeping/server-actions";
import { roundMoney } from "@/lib/format";

export async function createExpense(input: {
  expenseDate: string;
  payee: string;
  category: string;
  description: string;
  gross: number;
  vatRate: number;
  paymentMethod: string;
  receiptPath: string | null;
}): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  const { org, supabase } = c;

  const gross = roundMoney(Number(input.gross));
  if (!ISO_DATE.test(input.expenseDate)) return { error: "Enter the expense date." };
  if (!input.payee.trim()) return { error: "Enter who was paid." };
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(input.category)) return { error: "Pick a category." };
  if (!(VAT_RATES as readonly number[]).includes(input.vatRate)) return { error: "Invalid VAT rate." };
  if (!(PAYMENT_METHODS as readonly string[]).includes(input.paymentMethod)) return { error: "Pick a payment method." };
  if (!Number.isFinite(gross) || gross === 0) return { error: "Enter the amount paid." };

  const { net, vat } = splitGross(gross, input.vatRate);
  const receipt = input.receiptPath && input.receiptPath.startsWith(`${org.orgId}/`) ? input.receiptPath : null;

  const { error } = await supabase.from("expenses").insert({
    org_id: org.orgId,
    expense_date: input.expenseDate,
    payee: input.payee.trim().slice(0, 120),
    category: input.category,
    description: input.description.trim().slice(0, 300) || null,
    net_amount: net,
    vat_amount: vat,
    payment_method: input.paymentMethod,
    receipt_url: receipt,
  });
  if (error) return { error: error.message };
  refreshBookkeeping();
  return OK;
}

export async function deleteExpense(expenseId: string): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  const { org, supabase } = c;

  const { data: expense } = await supabase.from("expenses").select("id, bank_transaction_id").eq("id", expenseId).eq("org_id", org.orgId).maybeSingle();
  if (!expense) return { error: "Expense not found." };

  await supabase.from("expenses").delete().eq("id", expense.id);
  if (expense.bank_transaction_id) {
    await supabase.from("bank_transactions").update({ status: "unreviewed", matched_type: null, matched_id: null, note: null }).eq("id", expense.bank_transaction_id);
  }
  refreshBookkeeping();
  return OK;
}
