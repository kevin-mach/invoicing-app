import Link from "next/link";
import { Search } from "lucide-react";
import { DateInput } from "@/components/date-input";

const field = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50";

/** A search box with an optional date range. A plain GET form, so it works on any list page by
 * reading `q`, `from` and `to` from the address. */
export function ListSearch({
  basePath,
  q,
  from,
  to,
  placeholder,
}: {
  basePath: string;
  q: string;
  from: string;
  to: string;
  placeholder: string;
}) {
  const filtering = !!(q || from || to);
  return (
    <form method="get" action={basePath} className="no-print mt-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end dark:border-slate-800 dark:bg-slate-900">
      <div className="min-w-0">
        <label htmlFor="list-search-q" className="block text-xs font-medium text-slate-500 dark:text-slate-400">
          Search
        </label>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="list-search-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder={placeholder}
            autoComplete="off"
            className={`${field} pl-9`}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">From</label>
        <DateInput name="from" defaultValue={from} className={field} />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">To</label>
        <DateInput name="to" defaultValue={to} className={field} />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="min-h-10 flex-1 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 sm:flex-none dark:bg-slate-50 dark:text-slate-900"
        >
          Search
        </button>
        {filtering ? (
          <Link
            href={basePath}
            className="flex min-h-10 flex-1 items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:flex-none dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Clear
          </Link>
        ) : null}
      </div>
    </form>
  );
}
