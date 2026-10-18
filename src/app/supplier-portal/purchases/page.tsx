import Link from "next/link";
import { getCurrentVendorMember } from "@/lib/supabase/identity";
import { getVendorPurchases } from "@/lib/supabase/portal-queries";
import { formatGBP } from "@/lib/format";

export default async function SupplierPortalPurchasesPage() {
  const member = await getCurrentVendorMember();
  if (!member) return null;

  const purchases = await getVendorPurchases(member.vendorId);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Purchases</h1>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="px-4 py-3">
                  <Link
                    href={`/supplier-portal/purchases/${p.id}`}
                    className="font-medium text-slate-900 hover:underline dark:text-slate-50"
                  >
                    {p.purchase_date}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-50">{formatGBP(p.total)}</td>
              </tr>
            ))}
            {!purchases.length ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                  No purchases yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
