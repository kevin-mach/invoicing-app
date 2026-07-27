import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";

export default async function PurchasesPage() {
  const org = await getCurrentOrg();
  if (!org) return null;

  const supabase = await createClient();
  const { data: purchases } = await supabase
    .from("purchases")
    .select("id, status, purchase_date, vendors(name), purchase_line_items(qty, unit_cost)")
    .eq("org_id", org.orgId)
    .order("purchase_date", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Purchases</h1>
        <Link
          href="/dashboard/purchases/new"
          className="flex items-center gap-1 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-50 dark:text-slate-900"
        >
          <Plus size={16} /> New
        </Link>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Vendor</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Date</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Total cost</th>
            </tr>
          </thead>
          <tbody>
            {purchases?.map((p) => {
              const lines = (p.purchase_line_items ?? []) as { qty: number; unit_cost: number }[];
              const total = lines.reduce((sum, li) => sum + li.qty * li.unit_cost, 0);
              return (
                <tr key={p.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/purchases/${p.id}`} className="font-medium text-slate-900 hover:underline dark:text-slate-50">
                      {(p.vendors as unknown as { name: string } | null)?.name ?? "—"}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 sm:table-cell dark:text-slate-400">{p.purchase_date}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-50">${total.toFixed(2)}</td>
                </tr>
              );
            })}
            {!purchases?.length ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
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
