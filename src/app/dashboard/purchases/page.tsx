import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { formatGBP } from "@/lib/format";
import { Fragment } from "react";
import { cleanDate, matchesSearch } from "@/lib/search";
import { cleanGroup, groupRows, periodReportHref } from "@/lib/period";
import { ListSearch } from "@/components/list-search";
import { GroupHeaderRow } from "@/components/group-header-row";

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<{ q?: string; from?: string; to?: string; group?: string }> }) {
  const org = await getCurrentOrg();
  if (!org) return null;

  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const from = cleanDate(params.from);
  const to = cleanDate(params.to);
  const group = cleanGroup(params.group);

  const supabase = await createClient();
  let query = supabase
    .from("purchases")
    .select("id, status, purchase_date, supplier_ref, notes, vendors(name), purchase_line_items(description, qty, unit_cost)")
    .eq("org_id", org.orgId)
    .order("purchase_date", { ascending: false })
    .limit(2000);
  if (from) query = query.gte("purchase_date", from);
  if (to) query = query.lte("purchase_date", to);
  const { data: allPurchases } = await query;
  const totalOf = (p: { purchase_line_items: unknown }) =>
    ((p.purchase_line_items ?? []) as { qty: number; unit_cost: number }[]).reduce((sum, li) => sum + li.qty * li.unit_cost, 0);
  const purchases = (allPurchases ?? []).filter((p) => {
    const lines = (p.purchase_line_items ?? []) as { description: string }[];
    return matchesSearch(q, {
      text: [(p.vendors as unknown as { name: string } | null)?.name, p.supplier_ref, p.status, p.notes, ...lines.map((l) => l.description)],
      date: p.purchase_date,
      amounts: [totalOf(p)],
    });
  });
  const filtering = !!(q || from || to);

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

      <ListSearch basePath="/dashboard/purchases" q={q} from={from} to={to} group={group} placeholder="Supplier, bill number, item, date or amount…" />
      {filtering ? (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Showing {purchases.length} of {allPurchases?.length ?? 0} purchase{(allPurchases?.length ?? 0) === 1 ? "" : "s"}.
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Supplier</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Date</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Total cost</th>
            </tr>
          </thead>
          <tbody>
            {(group === "none" ? [{ key: "", title: "", rows: purchases }] : groupRows(purchases, (p) => p.purchase_date, group)).map((g) => (
              <Fragment key={g.key || "all"}>
                {group !== "none" ? (
                  <GroupHeaderRow
                    title={g.title}
                    count={g.rows.length}
                    noun="purchase"
                    total={g.rows.reduce((s, p) => s + totalOf(p), 0)}
                    colSpan={4}
                    reportHref={periodReportHref(g.key)}
                  />
                ) : null}
                {g.rows.map((p) => {
              const total = totalOf(p);
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
                  <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-50">{formatGBP(total)}</td>
                </tr>
              );
            })}
              </Fragment>
            ))}
            {!purchases.length ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  {filtering ? "No purchases match your search." : "No purchases yet."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
