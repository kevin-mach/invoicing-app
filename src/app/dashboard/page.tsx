import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";

export default async function DashboardHome() {
  const org = await getCurrentOrg();
  const supabase = await createClient();

  if (!org) return null;

  const [{ count: customerCount }, { count: vendorCount }, { count: itemCount }, { count: draftInvoiceCount }] =
    await Promise.all([
      supabase.from("customers").select("*", { count: "exact", head: true }).eq("org_id", org.orgId),
      supabase.from("vendors").select("*", { count: "exact", head: true }).eq("org_id", org.orgId),
      supabase.from("items").select("*", { count: "exact", head: true }).eq("org_id", org.orgId),
      supabase
        .from("invoices")
        .select("*", { count: "exact", head: true })
        .eq("org_id", org.orgId)
        .eq("status", "draft"),
    ]);

  const cards = [
    { label: "Customers", value: customerCount ?? 0, href: "/dashboard/customers" },
    { label: "Suppliers", value: vendorCount ?? 0, href: "/dashboard/vendors" },
    { label: "Items", value: itemCount ?? 0, href: "/dashboard/items" },
    { label: "Draft invoices", value: draftInvoiceCount ?? 0, href: "/dashboard/invoices" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
        Welcome back
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{org.orgName}</p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{c.value}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">{c.label}</div>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/dashboard/runs/new"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="font-medium text-slate-900 dark:text-slate-50">Plan a stock sheet</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Add supplier and customer stops, build checklists
          </div>
        </Link>
        <Link
          href="/dashboard/invoices/new"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="font-medium text-slate-900 dark:text-slate-50">New invoice</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Bill a customer for delivered items
          </div>
        </Link>
      </div>
    </div>
  );
}
