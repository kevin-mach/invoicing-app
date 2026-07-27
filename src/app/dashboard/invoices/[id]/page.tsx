import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { getItemsWithDefaultCost } from "@/lib/supabase/items";
import { InvoiceForm } from "@/components/invoice-form";
import { updateInvoiceLineItems } from "../actions";
import { InvoiceActions } from "./invoice-actions";
import { PrintableInvoice } from "./printable-invoice";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await getCurrentOrg();
  if (!org) return null;

  const supabase = await createClient();
  const [{ data: invoice }, { data: lineItems }, { data: customers }, items] = await Promise.all([
    supabase.from("invoices").select("*, customers(name, address)").eq("id", id).maybeSingle(),
    supabase.from("invoice_line_items").select("*").eq("invoice_id", id).order("sort_order"),
    supabase.from("customers").select("id, name").eq("org_id", org.orgId).order("name"),
    getItemsWithDefaultCost(org.orgId),
  ]);

  if (!invoice) notFound();

  const customer = invoice.customers as unknown as { name: string; address: string | null } | null;
  const updateWithId = updateInvoiceLineItems.bind(null, invoice.id);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
          Invoice {invoice.number ?? invoice.id.slice(0, 8)}
        </h1>
      </div>

      <div className="mt-4">
        <InvoiceActions invoiceId={invoice.id} status={invoice.status} />
      </div>

      <div id="invoice-print" className="mt-4">
        <PrintableInvoice
          orgName={org.orgName}
          invoiceNumber={invoice.number ?? invoice.id.slice(0, 8)}
          status={invoice.status}
          issueDate={invoice.issue_date}
          dueDate={invoice.due_date}
          customerName={customer?.name ?? "—"}
          customerAddress={customer?.address ?? null}
          lineItems={lineItems ?? []}
          subtotal={invoice.subtotal}
          tax={invoice.tax}
          total={invoice.total}
          notes={invoice.notes}
        />
      </div>

      <div className="no-print mt-10 border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Edit invoice</h2>
        <InvoiceForm
          action={updateWithId}
          customers={customers ?? []}
          items={items}
          initialCustomerId={invoice.customer_id}
          initialDueDate={invoice.due_date ?? ""}
          initialNotes={invoice.notes ?? ""}
          initialTax={invoice.tax}
          initialLineItems={(lineItems ?? []).map((li) => ({
            item_id: li.item_id,
            description: li.description,
            qty: li.qty,
            unit_cost: li.unit_cost,
            unit_price: li.unit_price,
          }))}
          submitLabel="Save changes"
        />
      </div>
    </div>
  );
}
