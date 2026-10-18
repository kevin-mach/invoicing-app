import { notFound } from "next/navigation";
import { getCurrentVendorMember } from "@/lib/supabase/identity";
import { getVendorPurchaseDetail } from "@/lib/supabase/portal-queries";
import { PdfShareActions } from "@/components/pdf-share-actions";
import { formatGBP } from "@/lib/format";

export default async function SupplierPortalPurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const member = await getCurrentVendorMember();
  if (!member) return null;

  const purchase = await getVendorPurchaseDetail(member.vendorId, id);
  if (!purchase) notFound();

  const total = purchase.lineItems.reduce((sum, li) => sum + (li.line_total ?? li.qty * li.unit_cost), 0);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
        Purchase order — {purchase.purchase_date}
      </h1>

      <div className="mt-4">
        <PdfShareActions
          targetId="purchase-print"
          filename={`purchase-${purchase.id.slice(0, 8)}.pdf`}
          title={`Purchase order ${purchase.purchase_date}`}
        />
      </div>

      <div id="purchase-print" className="mt-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 print:border-0 print:p-0 dark:print:bg-white">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 print:text-black">
              {purchase.orgName}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 print:text-black">
              Purchase from {purchase.vendorName}
            </p>
          </div>
          <span className="rounded px-2 py-1 text-xs font-medium capitalize bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 print:border print:border-black">
            {purchase.status}
          </span>
        </div>

        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400 print:text-black">{purchase.purchase_date}</p>

        <table className="mt-6 w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400 print:text-black">
            <tr>
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Price</th>
              <th className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {purchase.lineItems.map((li) => (
              <tr key={li.id} className="border-b border-slate-100 dark:border-slate-800 print:text-black">
                <td className="py-2">{li.description}</td>
                <td className="py-2 text-right">{li.qty}</td>
                <td className="py-2 text-right">{formatGBP(li.unit_cost)}</td>
                <td className="py-2 text-right">{formatGBP(li.line_total ?? li.qty * li.unit_cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50 print:text-black">
              <span>Total</span>
              <span>{formatGBP(total)}</span>
            </div>
          </div>
        </div>

        {purchase.notes ? (
          <p className="mt-4 border-t border-slate-200 pt-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400 print:text-black">
            {purchase.notes}
          </p>
        ) : null}
      </div>
    </div>
  );
}
