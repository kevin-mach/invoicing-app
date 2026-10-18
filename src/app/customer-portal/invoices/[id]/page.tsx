import { notFound } from "next/navigation";
import { getCurrentCustomerMember } from "@/lib/supabase/identity";
import { getCustomerInvoiceDetail } from "@/lib/supabase/portal-queries";
import { PrintableInvoice } from "@/app/dashboard/invoices/[id]/printable-invoice";
import { PdfShareActions } from "@/components/pdf-share-actions";

export default async function CustomerPortalInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const member = await getCurrentCustomerMember();
  if (!member) return null;

  const invoice = await getCustomerInvoiceDetail(member.customerId, id);
  if (!invoice) notFound();

  const vatTotal = invoice.lineItems.reduce((sum, li) => sum + (li.vat_amount ?? 0), 0);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
        Invoice {invoice.number ?? invoice.id.slice(0, 8)}
      </h1>

      <div className="mt-4">
        <PdfShareActions
          targetId="invoice-print"
          filename={`invoice-${invoice.number ?? invoice.id.slice(0, 8)}.pdf`}
          title={`Invoice ${invoice.number ?? invoice.id.slice(0, 8)}`}
        />
      </div>

      <div id="invoice-print" className="mt-4">
        <PrintableInvoice
          orgName={invoice.orgName}
          invoiceNumber={invoice.number ?? invoice.id.slice(0, 8)}
          status={invoice.status}
          issueDate={invoice.issue_date}
          dueDate={invoice.due_date}
          customerName={invoice.customerName}
          customerAddress={invoice.customerAddress}
          lineItems={invoice.lineItems}
          subtotal={invoice.subtotal}
          tax={invoice.tax}
          vatTotal={vatTotal}
          total={invoice.total}
          notes={invoice.notes}
        />
      </div>
    </div>
  );
}
