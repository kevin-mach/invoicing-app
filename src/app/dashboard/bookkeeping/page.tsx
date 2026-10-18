import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { requireBookkeeper } from "@/lib/bookkeeping/access";
import { getOverviewData } from "@/lib/bookkeeping/overview";
import { type Severity } from "@/lib/bookkeeping/exceptions";
import { resolvePeriod, toIsoDate } from "@/lib/bookkeeping/period";
import { formatGBP } from "@/lib/format";
import { PeriodFilter } from "@/components/bookkeeping/period-filter";
import { StatCard } from "@/components/bookkeeping/ui";

const SEVERITY_STYLE: Record<Severity, { label: string; className: string }> = {
  high: { label: "Needs action", className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  medium: { label: "Check", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  info: { label: "FYI", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
};

export default async function BookkeepingOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const org = await requireBookkeeper();
  if (!org) return null;

  const params = await searchParams;
  const { from, to } = resolvePeriod(params.from, params.to, "this-month");
  const today = toIsoDate(new Date());

  const stats = await getOverviewData(org.orgId, from, to, today);
  const { exceptions } = stats;

  return (
    <div className="space-y-6">
      <PeriodFilter basePath="/dashboard/bookkeeping" from={from} to={to} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Sales (ex VAT)" value={formatGBP(stats.sales)} hint={stats.salesIncludesPos ? "Invoices + POS sales" : "Sent and paid invoices"} />
        <StatCard label="Purchases (ex VAT)" value={formatGBP(stats.purchases)} hint="Supplier bills" />
        <StatCard label="Other expenses" value={formatGBP(stats.expenses)} />
        <StatCard
          label="Profit"
          value={formatGBP(stats.profit)}
          tone={stats.profit >= 0 ? "good" : "bad"}
          hint={stats.staff ? "Sales − purchases − expenses − staff" : "Sales − purchases − expenses"}
        />
        <StatCard
          label="Customers owe you"
          value={formatGBP(stats.owedToYou)}
          hint={stats.overdueToYou > 0 ? `${formatGBP(stats.overdueToYou)} overdue` : "Nothing overdue"}
          tone={stats.overdueToYou > 0 ? "bad" : undefined}
        />
        <StatCard
          label="You owe suppliers"
          value={formatGBP(stats.youOwe)}
          hint={stats.overdueYouOwe > 0 ? `${formatGBP(stats.overdueYouOwe)} past due` : "Nothing past due"}
          tone={stats.overdueYouOwe > 0 ? "bad" : undefined}
        />
        <StatCard label="Bank: money in" value={formatGBP(stats.moneyIn)} hint="Imported transactions" />
        <StatCard label="Bank: money out" value={formatGBP(stats.moneyOut)} />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Needs your attention</h2>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {exceptions.length ? `${exceptions.length} item${exceptions.length === 1 ? "" : "s"}` : ""}
          </span>
        </div>

        {exceptions.length ? (
          <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {exceptions.map((e) => {
              const style = SEVERITY_STYLE[e.severity];
              const Icon = e.severity === "info" ? Info : AlertTriangle;
              return (
                <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                  <Icon
                    size={18}
                    className={`mt-0.5 shrink-0 ${e.severity === "high" ? "text-red-500" : e.severity === "medium" ? "text-amber-500" : "text-slate-400"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900 dark:text-slate-50">{e.title}</p>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${style.className}`}>{style.label}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{e.detail}</p>
                  </div>
                  {e.href ? (
                    <Link href={e.href} className="shrink-0 text-sm font-medium text-slate-900 hover:underline dark:text-slate-50">
                      View →
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <CheckCircle2 className="text-green-500" size={22} />
            <p className="text-slate-700 dark:text-slate-300">
              Nothing needs attention right now — no overdue invoices or bills, duplicates, cost spikes or unreviewed
              bank lines.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
