import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentOrg } from "@/lib/supabase/org";
import { PeriodReport } from "@/components/period-report";
import { cleanDate } from "@/lib/search";
import { titleForRange } from "@/lib/period";
import { DailyReportActions } from "../../invoices/daily/daily-report-actions";

/** The whole report for one day, month, year or any range — opened by tapping a period on the
 * Reports page. */
export default async function PeriodReportPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  let from = cleanDate(params.from) || today;
  let to = cleanDate(params.to) || from;
  if (to < from) [from, to] = [to, from];

  const org = await getCurrentOrg();
  if (!org) return null;

  const title = titleForRange(from, to);

  return (
    <div className="max-w-4xl">
      <Link href="/dashboard/reports" className="no-print inline-flex min-h-10 items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
        <ArrowLeft size={16} /> Back to the sales report
      </Link>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">{title}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Everything for this period: what you sold, what you bought, the stock that came in, what you spent, and what was left over.
      </p>

      <div className="mt-4">
        <DailyReportActions reportDate={from === to ? from : `${from}_to_${to}`} targetId="period-report" title={`Report — ${title}`} />
      </div>

      <PeriodReport orgId={org.orgId} orgName={org.orgName} from={from} to={to} containerId="period-report" />
    </div>
  );
}
