import Link from "next/link";
import { Plus, Search, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { formatGBP } from "@/lib/format";

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;
  const org = await getCurrentOrg();
  if (!org) return null;

  const supabase = await createClient();
  const { data: categoryRows } = await supabase
    .from("items")
    .select("category")
    .eq("org_id", org.orgId)
    .not("category", "is", null);
  const categories = Array.from(new Set((categoryRows ?? []).map((r) => r.category as string))).sort();

  let query = supabase
    .from("items")
    .select("id, item_code, name, category, sale_price, vat_rate, stock_qty, unit, is_active")
    .eq("org_id", org.orgId)
    .order("name");

  if (q) {
    query = query.or(`name.ilike.%${q}%,item_code.ilike.%${q}%`);
  }
  if (category) {
    query = query.eq("category", category);
  }

  const { data: items } = await query;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Items</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/items/import"
            className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Upload size={16} /> Import
          </Link>
          <Link
            href="/dashboard/items/new"
            className="flex items-center gap-1 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-50 dark:text-slate-900"
          >
            <Plus size={16} /> New
          </Link>
        </div>
      </div>

      <form className="relative mt-4 max-w-sm">
        {category ? <input type="hidden" name="category" value={category} /> : null}
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name or code..."
          className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
        />
      </form>

      {categories.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={{ pathname: "/dashboard/items", query: q ? { q } : {} }}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              !category
                ? "border-slate-900 bg-slate-900 text-white dark:border-slate-50 dark:bg-slate-50 dark:text-slate-900"
                : "border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c}
              href={{ pathname: "/dashboard/items", query: q ? { q, category: c } : { category: c } }}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                category === c
                  ? "border-slate-900 bg-slate-900 text-white dark:border-slate-50 dark:bg-slate-50 dark:text-slate-900"
                  : "border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {c}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Category</th>
              <th className="px-4 py-3 text-right font-medium">Sale price</th>
              <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">VAT</th>
              <th className="hidden px-4 py-3 text-right font-medium md:table-cell">Stock</th>
            </tr>
          </thead>
          <tbody>
            {items?.map((item) => (
              <tr key={item.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{item.item_code}</td>
                <td className="px-4 py-3">
                  <Link href={`/dashboard/items/${item.id}`} className="font-medium text-slate-900 hover:underline dark:text-slate-50">
                    {item.name}
                  </Link>
                  {!item.is_active ? <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-800">inactive</span> : null}
                </td>
                <td className="hidden px-4 py-3 text-slate-600 sm:table-cell dark:text-slate-400">{item.category}</td>
                <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-50">{formatGBP(item.sale_price)}</td>
                <td className="hidden px-4 py-3 text-right text-slate-600 sm:table-cell dark:text-slate-400">
                  {item.vat_rate}%
                </td>
                <td className="hidden px-4 py-3 text-right text-slate-600 md:table-cell dark:text-slate-400">
                  {item.stock_qty} {item.unit}
                </td>
              </tr>
            ))}
            {!items?.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No items yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
