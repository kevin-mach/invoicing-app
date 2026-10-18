"use server";

import { autoProcessBankTransactions, loadOpenInvoices, loadUnpaidBills } from "@/lib/bookkeeping/auto-match";
import { bankFingerprint, type ParsedBankTxn } from "@/lib/bookkeeping/bank-csv";
import { EXPENSE_CATEGORIES, VAT_RATES } from "@/lib/bookkeeping/categories";
import {
  bookkeepingCtx,
  ISO_DATE,
  NOT_ALLOWED,
  OK,
  refreshBookkeeping,
  splitGross,
  syncInvoiceStatus,
  type ActionResult,
} from "@/lib/bookkeeping/server-actions";
import { roundMoney } from "@/lib/format";

export type ImportBankResult = {
  inserted: number;
  skipped: number;
  autoMatched: number;
  autoCategorised: number;
  autoBanked: number;
  autoPayroll: number;
  error: string | null;
};

const IMPORT_ZERO = { inserted: 0, skipped: 0, autoMatched: 0, autoCategorised: 0, autoBanked: 0, autoPayroll: 0 };

export async function importBankTransactions(rows: ParsedBankTxn[]): Promise<ImportBankResult> {
  const c = await bookkeepingCtx();
  if (!c) return { ...IMPORT_ZERO, error: NOT_ALLOWED.error };
  if (!Array.isArray(rows) || !rows.length) return { ...IMPORT_ZERO, error: "Nothing to import." };
  if (rows.length > 5000) return { ...IMPORT_ZERO, error: "Import at most 5,000 lines at a time." };

  const seen = new Map<string, number>();
  const records: { org_id: string; txn_date: string; description: string; amount: number; fingerprint: string }[] = [];

  for (const r of rows) {
    const amount = Number(r.amount);
    const description = String(r.description ?? "").trim().slice(0, 300);
    if (!ISO_DATE.test(r.txn_date) || !description || !Number.isFinite(amount) || amount === 0) continue;
    const clean: ParsedBankTxn = { txn_date: r.txn_date, description, amount: roundMoney(amount) };
    const base = bankFingerprint(clean, 0).replace(/\|0$/, "");
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);
    records.push({
      org_id: c.org.orgId,
      txn_date: clean.txn_date,
      description: clean.description,
      amount: clean.amount,
      fingerprint: bankFingerprint(clean, occurrence),
    });
  }

  let inserted = 0;
  const insertedIds: string[] = [];
  for (let i = 0; i < records.length; i += 500) {
    const { data, error } = await c.supabase
      .from("bank_transactions")
      .upsert(records.slice(i, i + 500), { onConflict: "org_id,fingerprint", ignoreDuplicates: true })
      .select("id");
    if (error) return { ...IMPORT_ZERO, inserted, skipped: records.length - inserted, error: error.message };
    inserted += data?.length ?? 0;
    insertedIds.push(...(data ?? []).map((d) => d.id));
  }

  let autoMatched = 0;
  let autoCategorised = 0;
  let autoBanked = 0;
  let autoPayroll = 0;
  if (insertedIds.length) {
    const [invoices, bills] = await Promise.all([loadOpenInvoices(c.supabase, c.org.orgId), loadUnpaidBills(c.supabase, c.org.orgId)]);
    const result = await autoProcessBankTransactions(c.supabase, c.org.orgId, insertedIds, invoices, bills);
    autoMatched = result.matched;
    autoCategorised = result.categorised;
    autoBanked = result.banked;
    autoPayroll = result.payroll;
  }

  refreshBookkeeping();
  return { inserted, skipped: rows.length - inserted, autoMatched, autoCategorised, autoBanked, autoPayroll, error: null };
}

export async function matchBankToInvoice(txnId: string, invoiceId: string): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  const { org, supabase } = c;

  const [{ data: txn }, { data: invoice }] = await Promise.all([
    supabase.from("bank_transactions").select("id, txn_date, amount, status").eq("id", txnId).eq("org_id", org.orgId).maybeSingle(),
    supabase.from("invoices").select("id, status").eq("id", invoiceId).eq("org_id", org.orgId).maybeSingle(),
  ]);
  if (!txn || !invoice) return { error: "Transaction or invoice not found." };
  if (txn.status === "matched") return { error: "That transaction is already matched." };
  if (txn.amount <= 0) return { error: "Only money coming in can be matched to an invoice." };
  if (invoice.status !== "sent" && invoice.status !== "overdue") {
    return { error: "Only sent or overdue invoices can receive a payment." };
  }

  const { error } = await supabase.from("invoice_payments").insert({
    org_id: org.orgId,
    invoice_id: invoiceId,
    amount: txn.amount,
    paid_on: txn.txn_date,
    method: "bank",
    bank_transaction_id: txn.id,
  });
  if (error) return { error: error.message };

  await supabase.from("bank_transactions").update({ status: "matched", matched_type: "invoice", matched_id: invoiceId }).eq("id", txn.id);
  await syncInvoiceStatus(supabase, org.orgId, invoiceId);
  refreshBookkeeping();
  return OK;
}

export async function matchBankToPurchase(txnId: string, purchaseId: string): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  const { org, supabase } = c;

  const [{ data: txn }, { data: purchase }] = await Promise.all([
    supabase.from("bank_transactions").select("id, txn_date, amount, status").eq("id", txnId).eq("org_id", org.orgId).maybeSingle(),
    supabase.from("purchases").select("id").eq("id", purchaseId).eq("org_id", org.orgId).maybeSingle(),
  ]);
  if (!txn || !purchase) return { error: "Transaction or bill not found." };
  if (txn.status === "matched") return { error: "That transaction is already matched." };
  if (txn.amount >= 0) return { error: "Only money going out can be matched to a supplier bill." };

  const { error } = await supabase.from("purchases").update({ paid_on: txn.txn_date }).eq("id", purchaseId).eq("org_id", org.orgId);
  if (error) return { error: error.message };
  await supabase.from("bank_transactions").update({ status: "matched", matched_type: "purchase", matched_id: purchaseId }).eq("id", txn.id);
  refreshBookkeeping();
  return OK;
}

export async function recordBankAsExpense(txnId: string, category: string, vatRate: number): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  const { org, supabase } = c;

  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(category)) return { error: "Pick a category." };
  if (!(VAT_RATES as readonly number[]).includes(vatRate)) return { error: "Invalid VAT rate." };

  const { data: txn } = await supabase
    .from("bank_transactions")
    .select("id, txn_date, description, amount, status")
    .eq("id", txnId)
    .eq("org_id", org.orgId)
    .maybeSingle();
  if (!txn) return { error: "Transaction not found." };
  if (txn.status === "matched") return { error: "That transaction is already matched." };
  if (txn.amount >= 0) return { error: "Only money going out can be recorded as an expense." };

  const { net, vat } = splitGross(Math.abs(txn.amount), vatRate);
  const { data: expense, error } = await supabase
    .from("expenses")
    .insert({
      org_id: org.orgId,
      expense_date: txn.txn_date,
      payee: txn.description.slice(0, 120),
      category,
      net_amount: net,
      vat_amount: vat,
      payment_method: "bank",
      bank_transaction_id: txn.id,
    })
    .select("id")
    .single();
  if (error || !expense) return { error: error?.message ?? "Could not record the expense." };

  await supabase.from("bank_transactions").update({ status: "matched", matched_type: "expense", matched_id: expense.id }).eq("id", txn.id);
  refreshBookkeeping();
  return OK;
}

export async function ignoreBankTransaction(txnId: string): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  const { error } = await c.supabase
    .from("bank_transactions")
    .update({ status: "ignored" })
    .eq("id", txnId)
    .eq("org_id", c.org.orgId)
    .eq("status", "unreviewed");
  if (error) return { error: error.message };
  refreshBookkeeping();
  return OK;
}

/** Undoes a match or an ignore, reversing whatever the match created. */
export async function unmatchBankTransaction(txnId: string): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  const { org, supabase } = c;

  const { data: txn } = await supabase
    .from("bank_transactions")
    .select("id, status, matched_type, matched_id, note")
    .eq("id", txnId)
    .eq("org_id", org.orgId)
    .maybeSingle();
  if (!txn) return { error: "Transaction not found." };

  if (txn.matched_type === "invoice" && txn.matched_id) {
    await supabase.from("invoice_payments").delete().eq("bank_transaction_id", txn.id);
    await syncInvoiceStatus(supabase, org.orgId, txn.matched_id);
  } else if (txn.matched_type === "purchase" && txn.matched_id) {
    await supabase.from("purchases").update({ paid_on: null }).eq("id", txn.matched_id).eq("org_id", org.orgId);
  } else if (txn.matched_type === "expense") {
    await supabase.from("expenses").delete().eq("bank_transaction_id", txn.id).eq("org_id", org.orgId);
  } else if (txn.matched_type === "cashup" && txn.matched_id) {
    await supabase.from("cash_ups").update({ banked_bank_transaction_id: null }).eq("id", txn.matched_id).eq("org_id", org.orgId);
  } else if (txn.matched_type === "payroll" && txn.matched_id) {
    if ((txn.note ?? "").includes("HMRC")) {
      await supabase.from("pay_runs").update({ hmrc_bank_transaction_id: null, hmrc_paid_on: null }).eq("id", txn.matched_id).eq("org_id", org.orgId);
    } else {
      await supabase.from("pay_runs").update({ net_pay_bank_transaction_id: null }).eq("id", txn.matched_id).eq("org_id", org.orgId);
    }
  }

  await supabase.from("bank_transactions").update({ status: "unreviewed", matched_type: null, matched_id: null, note: null }).eq("id", txn.id);
  refreshBookkeeping();
  return OK;
}
