import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PurchaseActions } from "./purchase-actions";
import { formatGBP } from "@/lib/format";
import { PropertyDetailsView } from "@/components/property-details";
import { cleanPropertyDetails } from "@/lib/property";
import { categoryOfLine } from "@/lib/bookkeeping/supplier-types";
import { getProductGroups } from "@/lib/bookkeeping/product-groups";

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: purchase }, { data: lineItems }, { data: scans }] = await Promise.all([
    supabase.from("purchases").select("*, vendors(name, address, supplier_type)").eq("id", id).maybeSingle(),
    supabase.from("purchase_line_items").select("*, items(category)").eq("purchase_id", id),
    supabase.from("receipt_scans").select("image_url").eq("purchase_id", id),
  ]);

  if (!purchase) notFound();
  const groups = await getProductGroups(purchase.org_id);

  const vendor = purchase.vendors as unknown as { name: string; address: string | null; supplier_type: string | null } | null;
  const property = cleanPropertyDetails(purchase.property_details);
  const net = (lineItems ?? []).reduce((sum, li) => sum + li.qty * li.unit_cost, 0);
  const vatTotal = (lineItems ?? []).reduce((sum, li) => sum + (li.vat_amount ?? 0), 0);
  const total = net + vatTotal;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
        Purchase from {vendor?.name ?? "—"}
      </h1>
      {vendor?.supplier_type ? <p className="text-sm text-slate-500 dark:text-slate-400">{vendor.supplier_type}</p> : null}
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {purchase.purchase_date}
        {purchase.supplier_ref ? ` · Supplier invoice ${purchase.supplier_ref}` : ""}
        {purchase.due_date ? ` · Due ${purchase.due_date}` : ""}
        {purchase.paid_on ? ` · Paid ${purchase.paid_on}` : ""}
      </p>

      <div className="mt-4">
        <PurchaseActions purchaseId={purchase.id} status={purchase.status} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 text-right font-medium">Qty</th>
              <th className="px-4 py-2 text-right font-medium">Cost ex VAT</th>
              <th className="px-4 py-2 text-right font-medium">VAT %</th>
              <th className="px-4 py-2 text-right font-medium">Total inc VAT</th>
            </tr>
          </thead>
          <tbody>
            {lineItems?.map((li) => (
              <tr key={li.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="px-4 py-2">
                  {li.description}
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {categoryOfLine(li.category, (li.items as unknown as { category: string | null } | null)?.category, vendor?.supplier_type, groups)}
                  </p>
                </td>
                <td className="px-4 py-2 text-right">{li.qty}</td>
                <td className="px-4 py-2 text-right">{formatGBP(li.unit_cost)}</td>
                <td className="px-4 py-2 text-right">{li.vat_rate}%</td>
                <td className="px-4 py-2 text-right">{formatGBP((li.line_total ?? li.qty * li.unit_cost) + (li.vat_amount ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end border-t border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
          {vatTotal > 0 ? `Net ${formatGBP(net)} + VAT ${formatGBP(vatTotal)} = ` : ""}Total: {formatGBP(total)}
        </div>
      </div>

      {property ? (
        <div className="mt-4">
          <PropertyDetailsView details={property} title="Agent's property statement" />
        </div>
      ) : null}

      {purchase.notes ? (
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">{purchase.notes}</p>
      ) : null}

      {scans?.length ? (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Scanned receipt</p>
          {scans.map((s, i) =>
            s.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={s.image_url} alt="Receipt" className="max-w-xs rounded-lg border border-slate-200 dark:border-slate-800" />
            ) : null
          )}
        </div>
      ) : null}
    </div>
  );
}
