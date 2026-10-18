import { createClient } from "@/lib/supabase/server";
import { roundMoney } from "@/lib/format";

const PAGE = 1000;

/** Supabase returns at most 1000 rows per request, so anything that sums or lists across a
 * period has to page — otherwise totals quietly stop counting after row 1000. */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

export type InvoiceSummary = {
  id: string;
  number: string | null;
  status: string;
  issueDate: string;
  dueDate: string | null;
  total: number;
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  paid: number;
  outstanding: number;
};

/** Invoices with what's been paid against them. Outstanding is zero for paid invoices even if
 * no payment row exists (older invoices were marked paid by hand). */
export async function getInvoiceSummaries(
  orgId: string,
  opts: { statuses?: string[]; from?: string; to?: string } = {}
): Promise<InvoiceSummary[]> {
  const supabase = await createClient();

  const invoices = await fetchAll<{
    id: string;
    number: string | null;
    status: string;
    issue_date: string;
    due_date: string | null;
    total: number;
    customer_id: string;
    customers: { name: string; email: string | null } | null;
  }>((f, t) => {
    let q = supabase
      .from("invoices")
      .select("id, number, status, issue_date, due_date, total, customer_id, customers(name, email)")
      .eq("org_id", orgId)
      .order("issue_date", { ascending: false })
      .order("id")
      .range(f, t);
    if (opts.statuses) q = q.in("status", opts.statuses);
    if (opts.from) q = q.gte("issue_date", opts.from);
    if (opts.to) q = q.lte("issue_date", opts.to);
    return q as unknown as PromiseLike<{
      data: {
        id: string;
        number: string | null;
        status: string;
        issue_date: string;
        due_date: string | null;
        total: number;
        customer_id: string;
        customers: { name: string; email: string | null } | null;
      }[] | null;
      error: { message: string } | null;
    }>;
  });

  const payments = await fetchAll<{ invoice_id: string; amount: number }>((f, t) =>
    supabase.from("invoice_payments").select("invoice_id, amount").eq("org_id", orgId).order("id").range(f, t)
  );
  const paidBy = new Map<string, number>();
  for (const p of payments) paidBy.set(p.invoice_id, roundMoney((paidBy.get(p.invoice_id) ?? 0) + p.amount));

  return invoices.map((i) => {
    const paid = paidBy.get(i.id) ?? 0;
    return {
      id: i.id,
      number: i.number,
      status: i.status,
      issueDate: i.issue_date,
      dueDate: i.due_date,
      total: i.total,
      customerId: i.customer_id,
      customerName: i.customers?.name ?? "—",
      customerEmail: i.customers?.email ?? null,
      paid,
      outstanding: i.status === "paid" ? 0 : roundMoney(Math.max(i.total - paid, 0)),
    };
  });
}

export type PurchaseSummary = {
  id: string;
  vendorId: string;
  vendorName: string;
  purchaseDate: string;
  dueDate: string | null;
  paidOn: string | null;
  supplierRef: string | null;
  status: string;
  net: number;
  vat: number;
  gross: number;
};

type PurchaseRow = {
  id: string;
  vendor_id: string;
  purchase_date: string;
  due_date: string | null;
  paid_on: string | null;
  supplier_ref: string | null;
  status: string;
  vendors: { name: string } | null;
  purchase_line_items: { qty: number; unit_cost: number; line_total: number | null; vat_amount: number | null }[];
};

export async function getPurchaseSummaries(
  orgId: string,
  opts: { from?: string; to?: string; since?: string; unpaidOnly?: boolean; recentOrUnpaidSince?: string } = {}
): Promise<PurchaseSummary[]> {
  const supabase = await createClient();

  const rows = await fetchAll<PurchaseRow>((f, t) => {
    let q = supabase
      .from("purchases")
      .select(
        "id, vendor_id, purchase_date, due_date, paid_on, supplier_ref, status, vendors(name), purchase_line_items(qty, unit_cost, line_total, vat_amount)"
      )
      .eq("org_id", orgId)
      .order("purchase_date", { ascending: false })
      .order("id")
      .range(f, t);
    if (opts.from) q = q.gte("purchase_date", opts.from);
    if (opts.to) q = q.lte("purchase_date", opts.to);
    if (opts.since) q = q.gte("purchase_date", opts.since);
    if (opts.unpaidOnly) q = q.is("paid_on", null);
    if (opts.recentOrUnpaidSince) q = q.or(`paid_on.is.null,purchase_date.gte.${opts.recentOrUnpaidSince}`);
    return q as unknown as PromiseLike<{ data: PurchaseRow[] | null; error: { message: string } | null }>;
  });

  return rows.map((p) => {
    const lines = p.purchase_line_items ?? [];
    const net = roundMoney(lines.reduce((s, l) => s + (l.line_total ?? l.qty * l.unit_cost), 0));
    const vat = roundMoney(lines.reduce((s, l) => s + (l.vat_amount ?? 0), 0));
    return {
      id: p.id,
      vendorId: p.vendor_id,
      vendorName: p.vendors?.name ?? "—",
      purchaseDate: p.purchase_date,
      dueDate: p.due_date,
      paidOn: p.paid_on,
      supplierRef: p.supplier_ref,
      status: p.status,
      net,
      vat,
      gross: roundMoney(net + vat),
    };
  });
}

export type PurchaseLineRow = {
  vendorId: string;
  vendorName: string;
  itemId: string | null;
  description: string;
  purchaseDate: string;
  unitCost: number;
  vatRate: number;
};

export async function getPurchaseLines(orgId: string, since: string): Promise<PurchaseLineRow[]> {
  const supabase = await createClient();
  type Row = {
    item_id: string | null;
    description: string;
    unit_cost: number;
    vat_rate: number;
    purchases: { vendor_id: string; purchase_date: string; vendors: { name: string } | null };
  };
  const rows = await fetchAll<Row>(
    (f, t) =>
      supabase
        .from("purchase_line_items")
        .select("item_id, description, unit_cost, vat_rate, purchases!inner(org_id, vendor_id, purchase_date, vendors(name))")
        .eq("purchases.org_id", orgId)
        .gte("purchases.purchase_date", since)
        .order("id")
        .range(f, t) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>
  );
  return rows.map((r) => ({
    vendorId: r.purchases.vendor_id,
    vendorName: r.purchases.vendors?.name ?? "—",
    itemId: r.item_id,
    description: r.description,
    purchaseDate: r.purchases.purchase_date,
    unitCost: r.unit_cost,
    vatRate: r.vat_rate,
  }));
}

export type PurchaseVatLine = { rate: number; net: number; vat: number };

/** Every bill line dated inside the period, for input-VAT totals by rate. */
export async function getPurchaseVatLines(orgId: string, from: string, to: string): Promise<PurchaseVatLine[]> {
  const supabase = await createClient();
  type Row = {
    qty: number;
    unit_cost: number;
    line_total: number | null;
    vat_rate: number;
    vat_amount: number | null;
    purchases: { org_id: string; purchase_date: string };
  };
  const rows = await fetchAll<Row>(
    (f, t) =>
      supabase
        .from("purchase_line_items")
        .select("qty, unit_cost, line_total, vat_rate, vat_amount, purchases!inner(org_id, purchase_date)")
        .eq("purchases.org_id", orgId)
        .gte("purchases.purchase_date", from)
        .lte("purchases.purchase_date", to)
        .order("id")
        .range(f, t) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>
  );
  return rows.map((r) => ({
    rate: r.vat_rate,
    net: r.line_total ?? roundMoney(r.qty * r.unit_cost),
    vat: r.vat_amount ?? 0,
  }));
}

export type InvoiceLineRow = {
  invoiceId: string;
  invoiceNumber: string | null;
  customerName: string;
  issueDate: string;
  description: string;
  qty: number;
  unitCost: number;
  unitPrice: number;
  vatRate: number;
  net: number;
  vat: number;
  /** Whether this invoice adds VAT on top of its total. */
  vatOnTop: boolean;
};

/** Lines from sent/paid/overdue invoices only — drafts aren't real sales yet. */
export async function getInvoiceLines(orgId: string, from: string, to: string): Promise<InvoiceLineRow[]> {
  const supabase = await createClient();
  type Row = {
    description: string;
    qty: number;
    unit_cost: number;
    unit_price: number;
    line_total: number | null;
    vat_rate: number;
    vat_amount: number | null;
    invoices: {
      id: string;
      number: string | null;
      issue_date: string;
      vat_on_top: boolean;
      customers: { name: string } | null;
    };
  };
  const rows = await fetchAll<Row>(
    (f, t) =>
      supabase
        .from("invoice_line_items")
        .select(
          "description, qty, unit_cost, unit_price, line_total, vat_rate, vat_amount, invoices!inner(id, number, status, org_id, issue_date, vat_on_top, customers(name))"
        )
        .eq("invoices.org_id", orgId)
        .neq("invoices.status", "draft")
        .gte("invoices.issue_date", from)
        .lte("invoices.issue_date", to)
        .order("id")
        .range(f, t) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>
  );
  return rows.map((r) => ({
    invoiceId: r.invoices.id,
    invoiceNumber: r.invoices.number,
    customerName: r.invoices.customers?.name ?? "—",
    issueDate: r.invoices.issue_date,
    description: r.description,
    qty: r.qty,
    unitCost: r.unit_cost,
    unitPrice: r.unit_price,
    vatRate: r.vat_rate,
    net: r.line_total ?? roundMoney(r.qty * r.unit_price),
    vat: r.vat_amount ?? 0,
    vatOnTop: r.invoices.vat_on_top,
  }));
}

export type ExpenseRow = {
  id: string;
  expense_date: string;
  payee: string;
  category: string;
  description: string | null;
  net_amount: number;
  vat_amount: number;
  total_amount: number | null;
  payment_method: string;
  receipt_url: string | null;
  bank_transaction_id: string | null;
};

export async function getExpenses(orgId: string, from: string, to: string): Promise<ExpenseRow[]> {
  const supabase = await createClient();
  return fetchAll<ExpenseRow>((f, t) =>
    supabase
      .from("expenses")
      .select(
        "id, expense_date, payee, category, description, net_amount, vat_amount, total_amount, payment_method, receipt_url, bank_transaction_id"
      )
      .eq("org_id", orgId)
      .gte("expense_date", from)
      .lte("expense_date", to)
      .order("expense_date", { ascending: false })
      .order("id")
      .range(f, t)
  );
}

export type BankRow = {
  id: string;
  txn_date: string;
  description: string;
  amount: number;
  status: string;
  matched_type: string | null;
  matched_id: string | null;
  note: string | null;
};

export async function getBankTransactions(
  orgId: string,
  opts: { from?: string; to?: string; status?: string }
): Promise<BankRow[]> {
  const supabase = await createClient();
  return fetchAll<BankRow>((f, t) => {
    let q = supabase
      .from("bank_transactions")
      .select("id, txn_date, description, amount, status, matched_type, matched_id, note")
      .eq("org_id", orgId)
      .order("txn_date", { ascending: false })
      .order("id")
      .range(f, t);
    if (opts.from) q = q.gte("txn_date", opts.from);
    if (opts.to) q = q.lte("txn_date", opts.to);
    if (opts.status) q = q.eq("status", opts.status);
    return q;
  });
}

export function sumBy<T>(rows: T[], pick: (row: T) => number): number {
  return roundMoney(rows.reduce((s, r) => s + pick(r), 0));
}

export type PosSalesRow = { sales_date: string; net_sales: number; vat_amount: number; source: string };

/** POS daily totals in a period. The same date can hold several sources (e.g. a Square feed and an
 * uploaded file), so callers should treat the sources as separate tills, not duplicates. */
export async function getPosSales(orgId: string, from: string, to: string): Promise<PosSalesRow[]> {
  const supabase = await createClient();
  return fetchAll<PosSalesRow>((f, t) =>
    supabase
      .from("pos_daily_sales")
      .select("sales_date, net_sales, vat_amount, source")
      .eq("org_id", orgId)
      .gte("sales_date", from)
      .lte("sales_date", to)
      .order("sales_date")
      .order("id")
      .range(f, t)
  );
}
