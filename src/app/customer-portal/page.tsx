import Link from "next/link";
import { getCurrentCustomerMember } from "@/lib/supabase/identity";
import { getCustomerInvoices } from "@/lib/supabase/portal-queries";
import { formatGBP } from "@/lib/format";

export default async function CustomerPortalHome() {
  const member = await getCurrentCustomerMember();
  if (!member) return null;

  const invoices = await getCustomerInvoices(member.customerId);
  const outstanding = invoices
    .filter((inv) => inv.status === "sent" || inv.status === "overdue")
    .reduce((sum, inv) => sum + inv.total, 0);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{member.customerName}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Welcome back, {member.userEmail}.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Outstanding balance</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">{formatGBP(outstanding)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Invoices on file</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">{invoices.length}</p>
        </div>
      </div>

      <div className="mt-6">
        <Link
          href="/customer-portal/invoices"
          className="text-sm font-medium text-slate-900 hover:underline dark:text-slate-50"
        >
          View all invoices →
        </Link>
      </div>
    </div>
  );
}
