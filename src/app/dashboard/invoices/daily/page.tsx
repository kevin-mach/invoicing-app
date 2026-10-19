import { getCurrentOrg } from "@/lib/supabase/org";
import { DateInput } from "@/components/date-input";
import { PeriodReport } from "@/components/period-report";
import { cleanDate } from "@/lib/search";
import { DailyReportActions } from "./daily-report-actions";

export default async function DailyReportPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  const reportDate = cleanDate(date) || new Date().toISOString().slice(0, 10);

  const org = await getCurrentOrg();
  if (!org) return null;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Daily report</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Everything for one day in one place: what you sold, what you bought, what you spent, and what&apos;s in stock.
      </p>

      <form className="no-print mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Date</label>
          <DateInput
            name="date"
            defaultValue={reportDate}
            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          />
        </div>
        <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-50 dark:text-slate-900">
          View
        </button>
      </form>

      <div className="mt-4">
        <DailyReportActions reportDate={reportDate} />
      </div>

      <PeriodReport orgId={org.orgId} orgName={org.orgName} from={reportDate} to={reportDate} containerId="daily-invoice-report" />
    </div>
  );
}
