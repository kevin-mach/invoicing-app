import Link from "next/link";
import { Plus, Search, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const org = await getCurrentOrg();
  if (!org) return null;

  const supabase = await createClient();
  let query = supabase
    .from("vendors")
    .select("id, name, contact, address")
    .eq("org_id", org.orgId)
    .order("name");

  if (q) query = query.ilike("name", `%${q}%`);

  const { data: vendors } = await query;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Vendors</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/vendors/import"
            className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Upload size={16} /> Import
          </Link>
          <Link
            href="/dashboard/vendors/new"
            className="flex items-center gap-1 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-50 dark:text-slate-900"
          >
            <Plus size={16} /> New
          </Link>
        </div>
      </div>

      <form className="relative mt-4 max-w-sm">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search vendors..."
          className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
        />
      </form>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Contact</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Address</th>
            </tr>
          </thead>
          <tbody>
            {vendors?.map((v) => (
              <tr key={v.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/vendors/${v.id}`} className="font-medium text-slate-900 hover:underline dark:text-slate-50">
                    {v.name}
                  </Link>
                </td>
                <td className="hidden px-4 py-3 text-slate-600 sm:table-cell dark:text-slate-400">{v.contact}</td>
                <td className="hidden px-4 py-3 text-slate-600 md:table-cell dark:text-slate-400">{v.address}</td>
              </tr>
            ))}
            {!vendors?.length ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                  No vendors yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
