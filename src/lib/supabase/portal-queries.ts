import { createClient } from "@/lib/supabase/server";

/**
 * Explicit-column-list queries for the customer portal. RLS scopes rows to the caller's own
 * customer_id, but RLS is row-level, not column-level — invoice_line_items also carries
 * unit_cost (the courier's internal cost), which must never reach a customer-portal viewer.
 * Portal pages should only fetch invoice data through these functions, never a raw
 * `.select("*")` against invoices/invoice_line_items.
 */

export type PortalInvoiceSummary = {
  id: string;
  number: string | null;
  status: string;
  issue_date: string;
  due_date: string | null;
  total: number;
};

export async function getCustomerInvoices(customerId: string): Promise<PortalInvoiceSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select("id, number, status, issue_date, due_date, total")
    .eq("customer_id", customerId)
    .order("issue_date", { ascending: false });
  return data ?? [];
}

export type PortalInvoiceLineItem = {
  id: string;
  description: string;
  qty: number;
  unit_price: number;
  vat_rate: number;
  vat_amount: number | null;
  line_total: number | null;
};

export type PortalInvoiceDetail = {
  id: string;
  number: string | null;
  status: string;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  tax: number;
  total: number;
  notes: string | null;
  customerName: string;
  customerAddress: string | null;
  lineItems: PortalInvoiceLineItem[];
  orgName: string;
} | null;

export async function getCustomerInvoiceDetail(
  customerId: string,
  invoiceId: string
): Promise<PortalInvoiceDetail> {
  const supabase = await createClient();

  const [{ data: invoice }, { data: lineItems }, { data: orgName }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, number, status, issue_date, due_date, subtotal, tax, total, notes, customers(name, address)")
      .eq("id", invoiceId)
      .eq("customer_id", customerId)
      .maybeSingle(),
    supabase
      .from("invoice_line_items")
      .select("id, description, qty, unit_price, vat_rate, vat_amount, line_total")
      .eq("invoice_id", invoiceId)
      .order("sort_order"),
    supabase.rpc("get_invoicing_org_name", { p_customer_id: customerId }),
  ]);

  if (!invoice) return null;

  const customer = invoice.customers as unknown as { name: string; address: string | null } | null;

  return {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    issue_date: invoice.issue_date,
    due_date: invoice.due_date,
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    total: invoice.total,
    notes: invoice.notes,
    customerName: customer?.name ?? "—",
    customerAddress: customer?.address ?? null,
    lineItems: lineItems ?? [],
    orgName: orgName ?? "",
  };
}

/**
 * Explicit-column-list queries for the supplier portal. A purchase's unit_cost is the
 * supplier's own price to the courier, so unlike the customer portal there's no cost field to
 * strip here — vendor_item_prices (the courier's full price-history table) is what stays out
 * of reach; these queries never touch it, only the supplier's own purchases.
 */

export type PortalPurchaseSummary = {
  id: string;
  status: string;
  purchase_date: string;
  total: number;
};

export async function getVendorPurchases(vendorId: string): Promise<PortalPurchaseSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("purchases")
    .select("id, status, purchase_date, purchase_line_items(qty, unit_cost)")
    .eq("vendor_id", vendorId)
    .order("purchase_date", { ascending: false });

  return (data ?? []).map((p) => {
    const lines = (p.purchase_line_items ?? []) as { qty: number; unit_cost: number }[];
    const total = lines.reduce((sum, li) => sum + li.qty * li.unit_cost, 0);
    return { id: p.id, status: p.status, purchase_date: p.purchase_date, total };
  });
}

export type PortalPurchaseLineItem = {
  id: string;
  description: string;
  qty: number;
  unit_cost: number;
  line_total: number | null;
};

export type PortalPurchaseDetail = {
  id: string;
  status: string;
  purchase_date: string;
  notes: string | null;
  vendorName: string;
  orgName: string;
  lineItems: PortalPurchaseLineItem[];
} | null;

export async function getVendorPurchaseDetail(
  vendorId: string,
  purchaseId: string
): Promise<PortalPurchaseDetail> {
  const supabase = await createClient();

  const [{ data: purchase }, { data: lineItems }, { data: orgName }] = await Promise.all([
    supabase
      .from("purchases")
      .select("id, status, purchase_date, notes, vendors(name)")
      .eq("id", purchaseId)
      .eq("vendor_id", vendorId)
      .maybeSingle(),
    supabase
      .from("purchase_line_items")
      .select("id, description, qty, unit_cost, line_total")
      .eq("purchase_id", purchaseId),
    supabase.rpc("get_purchasing_org_name", { p_vendor_id: vendorId }),
  ]);

  if (!purchase) return null;

  const vendor = purchase.vendors as unknown as { name: string } | null;

  return {
    id: purchase.id,
    status: purchase.status,
    purchase_date: purchase.purchase_date,
    notes: purchase.notes,
    vendorName: vendor?.name ?? "—",
    orgName: orgName ?? "",
    lineItems: lineItems ?? [],
  };
}

/**
 * Catalog views. RLS is the only scoping mechanism here (items has no customer_id/vendor_id
 * column to filter by) — the customer-portal policy grants the full active catalog of their
 * own courier org, the supplier-portal policy grants only items that vendor has actually
 * supplied. Neither policy exposes cost: items has no cost column at all.
 */

export type PortalItem = {
  id: string;
  item_code: string | null;
  name: string;
  category: string | null;
  unit: string;
  sale_price: number;
};

export async function getCustomerItems(): Promise<PortalItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select("id, item_code, name, category, unit, sale_price")
    .eq("is_active", true)
    .order("name");
  return data ?? [];
}

export type PortalSuppliedItem = {
  id: string;
  item_code: string | null;
  name: string;
  category: string | null;
  unit: string;
};

export async function getVendorItems(): Promise<PortalSuppliedItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select("id, item_code, name, category, unit")
    .order("name");
  return data ?? [];
}

/**
 * Delivery/pickup history — a portal viewer's own stop on each run, never other stops on the
 * same run. checklist_items.unit_price is intentionally never selected here: checklists are
 * pick lists, not financial documents, for either portal type.
 */

export type PortalDeliveryItem = { id: string; description: string; qty: number; unit: string };
export type PortalDelivery = {
  id: string;
  runDate: string;
  label: string | null;
  items: PortalDeliveryItem[];
};

function mapDeliveryRows(
  rows: { id: string; runs: unknown; checklists: unknown }[]
): PortalDelivery[] {
  return rows
    .map((rs) => {
      const run = rs.runs as { run_date: string } | null;
      const checklist = rs.checklists as { label: string | null; checklist_items: PortalDeliveryItem[] } | null;
      return {
        id: rs.id,
        runDate: run?.run_date ?? "",
        label: checklist?.label ?? null,
        items: checklist?.checklist_items ?? [],
      };
    })
    .sort((a, b) => b.runDate.localeCompare(a.runDate));
}

export async function getCustomerDeliveries(customerId: string): Promise<PortalDelivery[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("run_stops")
    .select("id, runs(run_date), checklists(label, checklist_items(id, description, qty, unit))")
    .eq("customer_id", customerId);
  return mapDeliveryRows((data ?? []) as unknown as { id: string; runs: unknown; checklists: unknown }[]);
}

export async function getVendorDeliveries(vendorId: string): Promise<PortalDelivery[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("run_stops")
    .select("id, runs(run_date), checklists(label, checklist_items(id, description, qty, unit))")
    .eq("vendor_id", vendorId);
  return mapDeliveryRows((data ?? []) as unknown as { id: string; runs: unknown; checklists: unknown }[]);
}

/** Recurring invoice templates already carry a customer_id, so this scopes naturally.
 * unit_cost is never selected — it's the courier's internal cost, not customer-safe. */

export type PortalRecurringLineItem = { id: string; description: string; qty: number; unit_price: number };
export type PortalRecurringTemplate = {
  id: string;
  cadence: string;
  next_run_date: string;
  active: boolean;
  lineItems: PortalRecurringLineItem[];
};

export async function getCustomerRecurringTemplates(customerId: string): Promise<PortalRecurringTemplate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("recurring_invoice_templates")
    .select("id, cadence, next_run_date, active, recurring_invoice_template_items(id, description, qty, unit_price)")
    .eq("customer_id", customerId)
    .order("next_run_date");

  return (data ?? []).map((t) => ({
    id: t.id,
    cadence: t.cadence,
    next_run_date: t.next_run_date,
    active: t.active,
    lineItems: (t.recurring_invoice_template_items ?? []) as PortalRecurringLineItem[],
  }));
}
