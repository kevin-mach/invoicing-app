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

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ q?: string; from?: string; to?: string; group?: string }> }) {
  const org = await getCurrentOrg();
  if (!org) return null;

  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const from = cleanDate(params.from);
  const to = cleanDate(params.to);
  const group = cleanGroup(params.group);

  const supabase = await createClient();
  let query = supabase
    .from("quotes")
    .select("id, recipient_name, recipient_contact, issue_date, quote_line_items(qty, unit_price)")
    .eq("org_id", org.orgId)
    .order("issue_date", { ascending: false })
    .limit(2000);
  if (from) query = query.gte("issue_date", from);
  if (to) query = query.lte("issue_date", to);
  const { data: allQuotes } = await query;
  const totalOf = (qt: { quote_line_items: unknown }) =>
    ((qt.quote_line_items ?? []) as { qty: number; unit_price: number }[]).reduce((sum, li) => sum + li.qty * li.unit_price, 0);
  const quotes = (allQuotes ?? []).filter((qt) =>
    matchesSearch(q, { text: [qt.recipient_name, qt.recipient_contact], date: qt.issue_date, amounts: [totalOf(qt)] })
  );
  const filtering = !!(q || from || to);

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

      <ListSearch basePath="/dashboard/quotes" q={q} from={from} to={to} group={group} placeholder="Name, contact, date or amount…" />
      {filtering ? (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Showing {quotes.length} of {allQuotes?.length ?? 0} quote{(allQuotes?.length ?? 0) === 1 ? "" : "s"}.
        </p>
      ) : null}

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
            {(group === "none" ? [{ key: "", title: "", rows: quotes }] : groupRows(quotes, (qt) => qt.issue_date, group)).map((g) => (
              <Fragment key={g.key || "all"}>
                {group !== "none" ? (
                  <GroupHeaderRow
                    title={g.title}
                    count={g.rows.length}
                    noun="quote"
                    total={g.rows.reduce((s, qt) => s + totalOf(qt), 0)}
                    colSpan={3}
                    reportHref={periodReportHref(g.key)}
                  />
                ) : null}
                {g.rows.map((qt) => {
              const total = totalOf(qt);
              return (
                <tr key={qt.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/quotes/${qt.id}`} className="font-medium text-slate-900 hover:underline dark:text-slate-50">
                      {qt.recipient_name}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 sm:table-cell dark:text-slate-400">{qt.issue_date}</td>
                  <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-50">{formatGBP(total)}</td>
                </tr>
              );
            })}
              </Fragment>
            ))}
            {!quotes.length ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                  {filtering ? "No quotes match your search." : "No quotes yet."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
