import { requireBookkeeper } from "@/lib/bookkeeping/access";
import { getReportItems } from "@/lib/bookkeeping/report-items";
import { cleanDate, cleanSpan, shiftDate, spanRange, type SideFilter, type VatFilter } from "@/lib/bookkeeping/report-math";
import { toIsoDate } from "@/lib/bookkeeping/period";
import { ReportExplorer } from "./report-explorer";

export default async function BookkeepingReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ span?: string; date?: string; vat?: string; side?: string; cat?: string }>;
}) {
  const org = await requireBookkeeper();
  if (!org) return null;

  const params = await searchParams;
  const today = toIsoDate(new Date());
  const span = cleanSpan(params.span);
  const date = cleanDate(params.date) ?? today;
  const { from, to } = spanRange(span, date);

  const items = await getReportItems(org.orgId, from, to);

  const vat: VatFilter = params.vat === "vat" || params.vat === "novat" ? params.vat : "all";
  const side: SideFilter = params.side === "sale" || params.side === "cost" ? params.side : "all";
  const category = params.cat && items.some((i) => i.category === params.cat) ? params.cat : null;

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Reports</h2>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Everything sold and bought on a day, in a month, in a year — or on any date you pick. Switch between items with VAT and items without, and tap a
        category to see just those items.
      </p>
      <ReportExplorer
        // A new period is a new report: start its switches from the address.
        key={`${span}-${date}`}
        items={items}
        orgName={org.orgName}
        span={span}
        date={date}
        from={from}
        to={to}
        prevDate={shiftDate(span, date, -1)}
        nextDate={shiftDate(span, date, 1)}
        today={today}
        initial={{ vat, side, category }}
      />
    </div>
  );
}
