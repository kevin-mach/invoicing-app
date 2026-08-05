import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { formatGBP } from "@/lib/format";

export default async function TemplatesPage() {
  const org = await getCurrentOrg();
  if (!org) return null;

  const supabase = await createClient();
  const [{ data: templates }, { data: pending }] = await Promise.all([
    supabase
      .from("recurring_invoice_templates")
      .select("id, cadence, next_run_date, active, customers(name)")
      .eq("org_id", org.orgId)
      .order("next_run_date"),
    supabase
      .from("invoices")
      .select("id, issue_date, total, customers(name)")
      .eq("org_id", org.orgId)
      .eq("status", "draft")
      .not("template_id", "is", null),
  ]);

  return (
    <div>
      {pending?.length ? (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <p className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
            Pending recurring invoices — review before sending
          </p>
          <ul className="space-y-1">
            {pending.map((inv) => (
              <li key={inv.id}>
                <Link href={`/dashboard/invoices/${inv.id}`} className="text-sm text-amber-900 underline dark:text-amber-200">
                  {(inv.customers as unknown as { name: string } | null)?.name ?? "—"} — {inv.issue_date} — {formatGBP(inv.total)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Recurring templates</h1>
        <Link
          href="/dashboard/templates/new"
          className="flex items-center gap-1 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-50 dark:text-slate-900"
        >
          <Plus size={16} /> New
        </Link>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Cadence</th>
              <th className="px-4 py-3 font-medium">Next run</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {templates?.map((t) => (
              <tr key={t.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/templates/${t.id}`} className="font-medium text-slate-900 hover:underline dark:text-slate-50">
                    {(t.customers as unknown as { name: string } | null)?.name ?? "—"}
                  </Link>
                </td>
                <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-400">{t.cadence}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{t.next_run_date}</td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${t.active ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                    {t.active ? "active" : "paused"}
                  </span>
                </td>
              </tr>
            ))}
            {!templates?.length ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  No recurring templates yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
