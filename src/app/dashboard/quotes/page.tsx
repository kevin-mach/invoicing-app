import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { formatGBP } from "@/lib/format";

export default async function QuotesPage() {
  const org = await getCurrentOrg();
  if (!org) return null;

  const supabase = await createClient();
  const { data: quotes } = await supabase
    .from("quotes")
    .select("id, recipient_name, issue_date, quote_line_items(qty, unit_price)")
    .eq("org_id", org.orgId)
    .order("issue_date", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Quotes</h1>
        <Link
          href="/dashboard/quotes/new"
          className="flex items-center gap-1 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-50 dark:text-slate-900"
        >
          <Plus size={16} /> New
        </Link>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Recipient</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Date</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {quotes?.map((q) => {
              const lines = (q.quote_line_items ?? []) as { qty: number; unit_price: number }[];
              const total = lines.reduce((sum, li) => sum + li.qty * li.unit_price, 0);
              return (
                <tr key={q.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/quotes/${q.id}`} className="font-medium text-slate-900 hover:underline dark:text-slate-50">
                      {q.recipient_name}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 sm:table-cell dark:text-slate-400">{q.issue_date}</td>
                  <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-50">{formatGBP(total)}</td>
                </tr>
              );
            })}
            {!quotes?.length ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                  No quotes yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
