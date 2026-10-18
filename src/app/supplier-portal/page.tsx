import Link from "next/link";
import { getCurrentVendorMember } from "@/lib/supabase/identity";
import { getVendorPurchases } from "@/lib/supabase/portal-queries";
import { formatGBP } from "@/lib/format";

export default async function SupplierPortalHome() {
  const member = await getCurrentVendorMember();
  if (!member) return null;

  const purchases = await getVendorPurchases(member.vendorId);
  const totalValue = purchases.reduce((sum, p) => sum + p.total, 0);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{member.vendorName}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Welcome back, {member.userEmail}.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total purchase value</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">{formatGBP(totalValue)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Purchases on file</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">{purchases.length}</p>
        </div>
      </div>

      <div className="mt-6">
        <Link
          href="/supplier-portal/purchases"
          className="text-sm font-medium text-slate-900 hover:underline dark:text-slate-50"
        >
          View all purchases →
        </Link>
      </div>
    </div>
  );
}
