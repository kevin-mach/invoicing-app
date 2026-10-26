import { createClient } from "@/lib/supabase/server";
import { requireBookkeeper } from "@/lib/bookkeeping/access";
import { STOCK_GROUPS } from "@/lib/bookkeeping/categories";
import { getProductGroups } from "@/lib/bookkeeping/product-groups";
import { SUPPLIER_TYPES } from "@/lib/bookkeeping/supplier-types";
import { GroupsManager } from "./groups-manager";

export default async function CategoriesPage() {
  const org = await requireBookkeeper();
  if (!org) return null;

  const supabase = await createClient();
  const [groups, { data: items }] = await Promise.all([getProductGroups(org.orgId), supabase.from("items").select("category").eq("org_id", org.orgId).eq("is_active", true)]);
  const counts: Record<string, number> = {};
  for (const i of items ?? []) {
    const k = (i.category ?? "").toLowerCase();
    if (k) counts[k] = (counts[k] ?? 0) + 1;
  }

  return (
    <div className="space-y-6">
      <GroupsManager groups={groups} counts={counts} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-semibold text-slate-900 dark:text-slate-50">Built-in groups</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Always available, alongside your own.</p>
          <ul className="mt-3 space-y-1 text-sm">
            {STOCK_GROUPS.map((g) => (
              <li key={g} className="flex justify-between gap-3">
                <span className="text-slate-700 dark:text-slate-300">{g}</span>
                <span className="text-slate-500">{counts[g.toLowerCase()] ?? 0} items</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-semibold text-slate-900 dark:text-slate-50">How a line gets its group</h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-400">
            <li>One of your keywords is in its description → your group.</li>
            <li>It&apos;s a catalogue item with a group → that group.</li>
            <li>The supplier is a specialist → the supplier&apos;s group (below).</li>
            <li>Otherwise the scanner&apos;s best guess, which you can change before saving.</li>
          </ol>
          <ul className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
            {SUPPLIER_TYPES.filter((t) => t.group).map((t) => (
              <li key={t.type}>
                {t.type} → {t.group}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
