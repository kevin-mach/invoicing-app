"use server";

import { revalidatePath } from "next/cache";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, STOCK_GROUPS, VAT_RATES } from "@/lib/bookkeeping/categories";
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

export type ReceiptLineInput = {
  description: string;
  qty: number;
  /** Amount before VAT for the whole line (negative for a discount or coupon). */
  net: number;
  vatRate: number;
  vat: number;
  category: string;
  /** Kind of product, for stock lines (Meat & poultry, Fruit & veg…). */
  itemGroup: string | null;
  isStock: boolean;
  /** The catalogue item this line is, if it's stock. */
  itemId: string | null;
};

export type SaveReceiptResult = ActionResult & { receiptId?: string; purchaseId?: string; expenseCount?: number };

const round4 = (n: number) => Math.round(n * 10000) / 10000;

/** Saves a scanned, itemised shop receipt without counting anything twice:
 * - stock lines (food, ingredients) become ONE paid purchase from the supplier — which adds the
 *   items to stock, records what was paid per item, and carries each line's own VAT rate;
 * - everything else becomes expenses, one per category and VAT rate, so the VAT return buckets
 *   them correctly even when a receipt mixes 20% and 0% items;
 * - a discount line goes with the stock purchase when there is one.
 * Expenses are written first and removed again if the purchase then fails. */
export async function saveReceipt(input: {
  merchant: string;
  date: string;
  paymentMethod: string;
  supplierId: string | null;
  receiptPath: string | null;
  lines: ReceiptLineInput[];
}): Promise<SaveReceiptResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  const { org, supabase } = c;

  const merchant = input.merchant.trim().slice(0, 120);
  if (!merchant) return { error: "Enter who the receipt is from." };
  if (!ISO_DATE.test(input.date)) return { error: "Enter the receipt date." };
  const method = (PAYMENT_METHODS as readonly string[]).includes(input.paymentMethod) ? input.paymentMethod : "card";
  if (!Array.isArray(input.lines) || !input.lines.length || input.lines.length > 120) return { error: "The receipt needs between 1 and 120 lines." };

  const lines: ReceiptLineInput[] = [];
  for (const l of input.lines) {
    const description = String(l.description ?? "").trim().slice(0, 200);
    const qty = Number(l.qty);
    const net = roundMoney(Number(l.net));
    const vat = roundMoney(Number(l.vat));
    if (!description) return { error: "Every line needs a description." };
    if (!Number.isFinite(qty) || qty <= 0) return { error: `"${description}" needs a quantity above zero.` };
    if (!Number.isFinite(net) || !Number.isFinite(vat)) return { error: `"${description}" has an invalid amount.` };
    if (!(VAT_RATES as readonly number[]).includes(Number(l.vatRate))) return { error: `"${description}" has an invalid VAT rate.` };
    if (Math.abs(vat - (net * Number(l.vatRate)) / 100) > 0.1) return { error: `The VAT on "${description}" doesn't match its rate.` };
    lines.push({
      description,
      qty,
      net,
      vat,
      vatRate: Number(l.vatRate),
      category: (EXPENSE_CATEGORIES as readonly string[]).includes(l.category) ? l.category : "Other",
      itemGroup: l.itemGroup && (STOCK_GROUPS as readonly string[]).includes(l.itemGroup) ? l.itemGroup : null,
      isStock: !!l.isStock,
      itemId: l.itemId ? String(l.itemId) : null,
    });
  }
  const receipt = input.receiptPath && input.receiptPath.startsWith(`${org.orgId}/`) ? input.receiptPath : null;

  // Stock lines only go through as stock when there is a real supplier and catalogue items to put them in.
  let supplierId: string | null = null;
  const stockLines = lines.filter((l) => l.isStock && l.itemId && l.net >= 0);
  if (input.supplierId && stockLines.length) {
    const { data: vendor } = await supabase.from("vendors").select("id").eq("id", input.supplierId).eq("org_id", org.orgId).maybeSingle();
    if (!vendor) return { error: "That supplier couldn't be found." };
    const ids = [...new Set(stockLines.map((l) => l.itemId as string))];
    const { data: found } = await supabase.from("items").select("id").eq("org_id", org.orgId).in("id", ids);
    if ((found ?? []).length !== ids.length) return { error: "One of the stock items couldn't be found." };
    supplierId = vendor.id;
  }
  const purchaseLines = supplierId ? stockLines : [];
  const discounts = supplierId ? lines.filter((l) => l.net < 0 && !purchaseLines.includes(l)) : [];
  const expenseLines = lines.filter((l) => !purchaseLines.includes(l) && !discounts.includes(l));

  // The whole receipt is kept (every line, VAT, totals, photo) so it can be shown as a table later;
  // the money itself lives in the purchase and expense rows below, which point back to it.
  // If there is exactly one run on the receipt's day, the stock purchase joins that day's run report.
  const { data: dayRuns } = await supabase.from("runs").select("id").eq("org_id", org.orgId).eq("run_date", input.date);
  const runId = dayRuns?.length === 1 ? dayRuns[0].id : null;
  const { data: receiptRow, error: receiptError } = await supabase
    .from("scanned_receipts")
    .insert({
      org_id: org.orgId,
      merchant,
      receipt_date: input.date,
      payment_method: method,
      net_total: roundMoney(lines.reduce((s, l) => s + l.net, 0)),
      vat_total: roundMoney(lines.reduce((s, l) => s + l.vat, 0)),
      receipt_url: receipt,
      supplier_id: supplierId,
      run_id: runId,
    })
    .select("id")
    .single();
  if (receiptError || !receiptRow) return { error: receiptError?.message ?? "Couldn't save the receipt." };
  const receiptId = receiptRow.id;
  // Deleting the receipt row removes its expenses (cascade); the purchase, if made, is removed separately.
  const undo = async (purchaseId?: string) => {
    if (purchaseId) await supabase.from("purchases").delete().eq("id", purchaseId);
    await supabase.from("scanned_receipts").delete().eq("id", receiptId);
  };

  // Expenses: one row per category + VAT rate.
  const groups = new Map<string, { category: string; net: number; vat: number; items: string[] }>();
  for (const l of expenseLines) {
    const key = `${l.category}|${l.vatRate}`;
    const g = groups.get(key) ?? { category: l.category, net: 0, vat: 0, items: [] };
    g.net = roundMoney(g.net + l.net);
    g.vat = roundMoney(g.vat + l.vat);
    g.items.push(`${l.qty !== 1 ? `${l.qty} × ` : ""}${l.description} £${roundMoney(l.net + l.vat).toFixed(2)}`);
    groups.set(key, g);
  }
  const expenseRows = [...groups.values()]
    .filter((g) => roundMoney(g.net + g.vat) !== 0)
    .map((g) => ({
      org_id: org.orgId,
      expense_date: input.date,
      payee: merchant,
      category: g.category,
      description: g.items.join("; ").slice(0, 300),
      net_amount: g.net,
      vat_amount: g.vat,
      payment_method: method,
      receipt_url: receipt,
      receipt_id: receiptId,
    }));

  if (expenseRows.length) {
    const { error } = await supabase.from("expenses").insert(expenseRows);
    if (error) {
      await undo();
      return { error: error.message };
    }
  }

  let purchaseId: string | undefined;
  if (supplierId && purchaseLines.length) {
    const { data: purchase, error } = await supabase
      .from("purchases")
      .insert({
        org_id: org.orgId,
        vendor_id: supplierId,
        purchase_date: input.date,
        paid_on: input.date,
        status: "recorded",
        notes: `Scanned receipt — paid by ${method}`,
        receipt_url: receipt,
        paid_with: method,
        receipt_id: receiptId,
        run_id: runId,
      })
      .select("id")
      .single();
    if (error || !purchase) {
      await undo();
      return { error: error?.message ?? "Couldn't save the stock purchase." };
    }
    const rows = [...purchaseLines, ...discounts].map((l) => ({
      purchase_id: purchase.id,
      item_id: l.net < 0 ? null : l.itemId,
      description: l.description,
      qty: l.net < 0 ? 1 : l.qty,
      unit_cost: l.net < 0 ? l.net : round4(l.net / l.qty),
      vat_rate: l.vatRate,
    }));
    const { error: lineError } = await supabase.from("purchase_line_items").insert(rows);
    if (lineError) {
      await undo(purchase.id);
      return { error: lineError.message };
    }
    purchaseId = purchase.id;
  }

  const takeStockBack = async (pid: string) => {
    const { data: pl } = await supabase.from("purchase_line_items").select("item_id, qty").eq("purchase_id", pid);
    for (const row of (pl ?? []).filter((r) => r.item_id)) {
      const { data: it } = await supabase.from("items").select("stock_qty").eq("id", row.item_id as string).eq("org_id", org.orgId).maybeSingle();
      if (it) await supabase.from("items").update({ stock_qty: roundMoney(it.stock_qty - row.qty) }).eq("id", row.item_id as string);
    }
  };

  const { error: receiptLinesError } = await supabase.from("scanned_receipt_lines").insert(
    lines.map((l, idx) => ({
      receipt_id: receiptId,
      sort_order: idx,
      description: l.description,
      qty: l.qty,
      net_amount: l.net,
      vat_rate: l.vatRate,
      vat_amount: l.vat,
      category: l.category,
      item_group: l.itemGroup,
      is_stock: purchaseLines.includes(l),
      item_id: purchaseLines.includes(l) ? l.itemId : null,
    }))
  );
  if (receiptLinesError) {
    if (purchaseId) await takeStockBack(purchaseId);
    await undo(purchaseId);
    return { error: receiptLinesError.message };
  }
  if (purchaseId) await supabase.from("scanned_receipts").update({ purchase_id: purchaseId }).eq("id", receiptId);

  refreshBookkeeping();
  revalidatePath("/dashboard/purchases");
  revalidatePath("/dashboard/stock");
  revalidatePath("/dashboard/items");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/runs", "layout");
  return { error: null, receiptId, purchaseId, expenseCount: expenseRows.length };
}

/** Removes a scanned receipt and everything it created: its expense rows, its stock purchase, and
 * the stock that purchase added. Removing a purchase is an owner/admin action, so for anyone else
 * the whole thing is refused rather than half-done. */
export async function deleteReceipt(receiptId: string): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  const { org, supabase } = c;

  const { data: receipt } = await supabase.from("scanned_receipts").select("id, purchase_id").eq("id", receiptId).eq("org_id", org.orgId).maybeSingle();
  if (!receipt) return { error: "Receipt not found." };

  if (receipt.purchase_id) {
    const { data: lines } = await supabase.from("purchase_line_items").select("item_id, qty").eq("purchase_id", receipt.purchase_id);
    const { data: removed } = await supabase.from("purchases").delete().eq("id", receipt.purchase_id).eq("org_id", org.orgId).select("id");
    if (!removed?.length) return { error: "Only the owner or an admin can remove the stock purchase from a receipt." };
    for (const row of (lines ?? []).filter((r) => r.item_id)) {
      const { data: it } = await supabase.from("items").select("stock_qty").eq("id", row.item_id as string).eq("org_id", org.orgId).maybeSingle();
      if (it) await supabase.from("items").update({ stock_qty: roundMoney(it.stock_qty - row.qty) }).eq("id", row.item_id as string);
    }
  }
  const { error } = await supabase.from("scanned_receipts").delete().eq("id", receipt.id);
  if (error) return { error: error.message };

  refreshBookkeeping();
  revalidatePath("/dashboard/purchases");
  revalidatePath("/dashboard/stock");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/runs", "layout");
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
