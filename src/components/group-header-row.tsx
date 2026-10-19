import Link from "next/link";
import { formatGBP } from "@/lib/format";

/** The heading row of a day / month / year group in a list: what period it is, how many rows and
 * what they add up to, with a link to that period's full report. */
export function GroupHeaderRow({
  title,
  count,
  noun,
  total,
  colSpan,
  reportHref,
}: {
  title: string;
  count: number;
  noun: string;
  total: number;
  colSpan: number;
  reportHref: string;
}) {
  return (
    <tr className="border-b border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800/60">
      <td colSpan={colSpan} className="px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-semibold text-slate-900 dark:text-slate-50">{title}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {count} {noun}
            {count === 1 ? "" : "s"} · {formatGBP(total)}
          </span>
          <Link href={reportHref} className="ml-auto text-xs font-medium text-slate-700 underline hover:text-slate-900 dark:text-slate-300">
            Open full report
          </Link>
        </div>
      </td>
    </tr>
  );
}
