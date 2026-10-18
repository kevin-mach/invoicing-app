import Link from "next/link";
import { periodPresets } from "@/lib/bookkeeping/period";
import { DateInput } from "@/components/date-input";

/** From/to date filter with one-click presets. Submits as a GET so the period lives in the URL
 * (shareable, and the server page re-renders with it). `extra` keeps other filters on the page. */
export function PeriodFilter({
  basePath,
  from,
  to,
  extra = {},
}: {
  basePath: string;
  from: string;
  to: string;
  extra?: Record<string, string>;
}) {
  const presets = periodPresets();
  const extraQuery = Object.entries(extra)
    .map(([k, v]) => `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("");

  return (
    <div className="no-print rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <form action={basePath} className="flex flex-wrap items-end gap-3">
        {Object.entries(extra).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">From</label>
          <DateInput
            name="from"
            defaultValue={from}
            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">To</label>
          <DateInput
            name="to"
            defaultValue={to}
            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-50 dark:text-slate-900"
        >
          Apply
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {presets.map((p) => {
          const active = p.from === from && p.to === to;
          return (
            <Link
              key={p.key}
              href={`${basePath}?from=${p.from}&to=${p.to}${extraQuery}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                active
                  ? "bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900"
                  : "border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {p.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
