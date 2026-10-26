import { createClient } from "@/lib/supabase/server";
import { roundMoney } from "@/lib/format";
import { fetchAll, getExpenses, getPosSales, type ExpenseRow } from "./data";
import { getProductGroups } from "./product-groups";
import { categoryOfLine } from "./supplier-types";
import type { ReportItem } from "./report-math";

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

type ReceiptLine = {
  receipt_id: string;
  id: string;
  sort_order: number;
  description: string;
  qty: number;
  net_amount: number;
  vat_amount: number;
  category: string | null;
  item_group: string | null;
  is_stock: boolean;
};

/** Every item that was sold or bought in the period — one list the report can total, filter by VAT
 * and group by category. Nothing is counted twice: a scanned receipt's items replace the expense rows
 * made from it (only when they add up to the same amounts, otherwise the expense rows are used), and
 * its stock lines are already purchase lines. */
export async function getReportItems(orgId: string, from: string, to: string): Promise<ReportItem[]> {
  const supabase = await createClient();
  const groups = await getProductGroups(orgId);

  type InvoiceLine = {
    id: string;
    description: string;
    qty: number;
    unit_price: number;
    line_total: number | null;
    vat_amount: number | null;
    items: { category: string | null } | { category: string | null }[] | null;
    invoices: { id: string; number: string | null; issue_date: string; customers: { name: string } | { name: string }[] | null } | { id: string; number: string | null; issue_date: string; customers: { name: string } | { name: string }[] | null }[];
  };
  type PurchaseLine = {
    id: string;
    description: string;
    qty: number;
    unit_cost: number;
    line_total: number | null;
    vat_amount: number | null;
    category: string | null;
    items: { category: string | null } | { category: string | null }[] | null;
    purchases: { id: string; purchase_date: string; vendors: { name: string; supplier_type: string | null } | { name: string; supplier_type: string | null }[] | null } | { id: string; purchase_date: string; vendors: { name: string; supplier_type: string | null } | { name: string; supplier_type: string | null }[] | null }[];
  };
  type CreditLine = { id: string; description: string; qty: number; net_amount: number; vat_amount: number };
  type SupplierCreditLine = CreditLine & { credit_notes: { id: string; credit_date: string; supplier_name: string | null } | { id: string; credit_date: string; supplier_name: string | null }[] };
  type CustomerCreditLine = CreditLine & { customer_credit_notes: { id: string; credit_date: string; number: string; customers: { name: string } | { name: string }[] | null } | { id: string; credit_date: string; number: string; customers: { name: string } | { name: string }[] | null }[] };

  const [invoiceLines, pos, purchaseLines, supplierCredits, customerCredits, expenses] = await Promise.all([
    fetchAll<InvoiceLine>(
      (f, t) =>
        supabase
          .from("invoice_line_items")
          .select("id, description, qty, unit_price, line_total, vat_amount, items(category), invoices!inner(id, number, status, org_id, issue_date, customers(name))")
          .eq("invoices.org_id", orgId)
          .neq("invoices.status", "draft")
          .gte("invoices.issue_date", from)
          .lte("invoices.issue_date", to)
          .order("id")
          .range(f, t) as unknown as Page<InvoiceLine>
    ),
    getPosSales(orgId, from, to),
    fetchAll<PurchaseLine>(
      (f, t) =>
        supabase
          .from("purchase_line_items")
          .select("id, description, qty, unit_cost, line_total, vat_amount, category, items(category), purchases!inner(id, org_id, purchase_date, vendors(name, supplier_type))")
          .eq("purchases.org_id", orgId)
          .gte("purchases.purchase_date", from)
          .lte("purchases.purchase_date", to)
          .order("id")
          .range(f, t) as unknown as Page<PurchaseLine>
    ),
    fetchAll<SupplierCreditLine>(
      (f, t) =>
        supabase
          .from("credit_note_lines")
          .select("id, description, qty, net_amount, vat_amount, credit_notes!inner(id, org_id, credit_date, supplier_name)")
          .eq("credit_notes.org_id", orgId)
          .gte("credit_notes.credit_date", from)
          .lte("credit_notes.credit_date", to)
          .order("id")
          .range(f, t) as unknown as Page<SupplierCreditLine>
    ),
    fetchAll<CustomerCreditLine>(
      (f, t) =>
        supabase
          .from("customer_credit_note_lines")
          .select("id, description, qty, net_amount, vat_amount, customer_credit_notes!inner(id, org_id, number, credit_date, customers(name))")
          .eq("customer_credit_notes.org_id", orgId)
          .gte("customer_credit_notes.credit_date", from)
          .lte("customer_credit_notes.credit_date", to)
          .order("id")
          .range(f, t) as unknown as Page<CustomerCreditLine>
    ),
    getExpenses(orgId, from, to),
  ]);

  const items: ReportItem[] = [];

  // ---- Sales ----
  for (const l of invoiceLines) {
    const inv = one(l.invoices);
    if (!inv) continue;
    items.push({
      id: `inv-${l.id}`,
      date: inv.issue_date,
      side: "sale",
      kind: "Invoice",
      description: l.description,
      party: one(inv.customers)?.name ?? "—",
      category: one(l.items)?.category?.trim() || "Sales",
      qty: l.qty,
      net: l.line_total ?? roundMoney(l.qty * l.unit_price),
      vat: l.vat_amount ?? 0,
      href: `/dashboard/invoices/${inv.id}`,
    });
  }
  pos.forEach((p, n) =>
    items.push({
      id: `pos-${p.sales_date}-${p.source}-${n}`,
      date: p.sales_date,
      side: "sale",
      kind: "POS",
      description: `POS sales (${p.source})`,
      party: "Till",
      category: "POS sales",
      qty: null,
      net: p.net_sales,
      vat: p.vat_amount,
      href: "/dashboard/bookkeeping/pos",
    })
  );
  for (const l of customerCredits) {
    const cn = one(l.customer_credit_notes);
    if (!cn) continue;
    items.push({
      id: `ccn-${l.id}`,
      date: cn.credit_date,
      side: "sale",
      kind: "Credit note",
      description: `${l.description} (credit ${cn.number})`,
      party: one(cn.customers)?.name ?? "—",
      category: "Customer credit notes",
      qty: l.qty,
      net: -l.net_amount,
      vat: -l.vat_amount,
      href: `/dashboard/bookkeeping/credit-notes/customer/${cn.id}`,
    });
  }

  // ---- Costs: bills ----
  for (const l of purchaseLines) {
    const p = one(l.purchases);
    if (!p) continue;
    const vendor = one(p.vendors);
    items.push({
      id: `pur-${l.id}`,
      date: p.purchase_date,
      side: "cost",
      kind: "Purchase",
      description: l.description,
      party: vendor?.name ?? "Supplier",
      category: categoryOfLine(l.category, one(l.items)?.category, vendor?.supplier_type, groups),
      qty: l.qty,
      net: l.line_total ?? roundMoney(l.qty * l.unit_cost),
      vat: l.vat_amount ?? 0,
      href: `/dashboard/purchases/${p.id}`,
    });
  }
  for (const l of supplierCredits) {
    const cn = one(l.credit_notes);
    if (!cn) continue;
    items.push({
      id: `scn-${l.id}`,
      date: cn.credit_date,
      side: "cost",
      kind: "Credit note",
      description: l.description,
      party: cn.supplier_name ?? "Supplier",
      category: "Supplier credit notes",
      qty: l.qty,
      net: -l.net_amount,
      vat: -l.vat_amount,
      href: "/dashboard/bookkeeping/credit-notes",
    });
  }

  // ---- Costs: expenses, itemised from their scanned receipt where it adds up ----
  const receiptIds = [...new Set(expenses.map((e) => e.receipt_id).filter((id): id is string => !!id))];
  const linesByReceipt = new Map<string, ReceiptLine[]>();
  for (let i = 0; i < receiptIds.length; i += 100) {
    const chunk = receiptIds.slice(i, i + 100);
    const rows = await fetchAll<ReceiptLine>(
      (f, t) =>
        supabase
          .from("scanned_receipt_lines")
          .select("receipt_id, id, sort_order, description, qty, net_amount, vat_amount, category, item_group, is_stock")
          .in("receipt_id", chunk)
          .order("id")
          .range(f, t) as unknown as Page<ReceiptLine>
    );
    for (const r of rows) {
      const list = linesByReceipt.get(r.receipt_id) ?? [];
      list.push(r);
      linesByReceipt.set(r.receipt_id, list);
    }
  }

  const expenseItem = (e: ExpenseRow): ReportItem => ({
    id: `exp-${e.id}`,
    date: e.expense_date,
    side: "cost",
    kind: e.category === "Fuel" ? "Fuel" : e.receipt_id ? "Receipt" : "Expense",
    description: e.description?.trim() || e.payee,
    party: e.payee,
    category: e.category,
    qty: null,
    net: e.net_amount,
    vat: e.vat_amount,
    href: "/dashboard/bookkeeping/expenses",
  });

  const byReceipt = new Map<string, ExpenseRow[]>();
  for (const e of expenses) {
    if (!e.receipt_id) {
      items.push(expenseItem(e));
      continue;
    }
    const list = byReceipt.get(e.receipt_id) ?? [];
    list.push(e);
    byReceipt.set(e.receipt_id, list);
  }
  const near = (a: number, b: number) => Math.abs(a - b) <= 0.02;
  for (const [receiptId, rows] of byReceipt) {
    const expNet = roundMoney(rows.reduce((s, r) => s + r.net_amount, 0));
    const expVat = roundMoney(rows.reduce((s, r) => s + r.vat_amount, 0));
    const lines = linesByReceipt.get(receiptId) ?? [];
    const sum = (ls: ReceiptLine[]) => ({ net: roundMoney(ls.reduce((s, l) => s + l.net_amount, 0)), vat: roundMoney(ls.reduce((s, l) => s + l.vat_amount, 0)) });
    const candidates = [lines.filter((l) => !l.is_stock), lines];
    const match = candidates.find((ls) => ls.length > 0 && near(sum(ls).net, expNet) && near(sum(ls).vat, expVat));
    if (!match) {
      rows.forEach((r) => items.push(expenseItem(r)));
      continue;
    }
    const date = rows[0].expense_date;
    const payee = rows[0].payee;
    [...match]
      .sort((a, b) => a.sort_order - b.sort_order)
      .forEach((l) =>
        items.push({
          id: `rcl-${l.id}`,
          date,
          side: "cost",
          kind: "Receipt",
          description: l.description,
          party: payee,
          category: l.category ?? l.item_group ?? rows[0].category,
          qty: l.qty,
          net: l.net_amount,
          vat: l.vat_amount,
          href: "/dashboard/bookkeeping/expenses",
        })
      );
  }

  return items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.side === b.side ? a.description.localeCompare(b.description) : a.side === "sale" ? -1 : 1));
}
