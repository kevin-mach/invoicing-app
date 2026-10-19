"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

/** A table row that opens to show more underneath. `cells` are the row's normal <td>s; the toggle
 * and any `actions` (like a delete button) go in one extra cell at the end. Clicking anywhere on the
 * row opens it, except on links and buttons, which do their own thing. */
export function ExpandableRow({
  cells,
  actions,
  detail,
  colSpan,
  openLabel = "See items",
  className = "",
}: {
  cells: ReactNode;
  actions?: ReactNode;
  detail: ReactNode;
  /** Total columns, including the toggle cell. */
  colSpan: number;
  openLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr
        className={`cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/30 ${className}`}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a,button,input,select")) return;
          setOpen((o) => !o);
        }}
      >
        {cells}
        <td className="whitespace-nowrap px-4 py-3 text-right">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-slate-600 underline-offset-2 hover:underline dark:text-slate-300"
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {open ? "Hide" : openLabel}
          </button>
          {actions ? <span className="ml-2 inline-block align-middle">{actions}</span> : null}
        </td>
      </tr>
      {open ? (
        <tr className="border-b border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-950/40">
          <td colSpan={colSpan} className="px-4 py-3">
            {detail}
          </td>
        </tr>
      ) : null}
    </>
  );
}
