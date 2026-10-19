"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CircleHelp, Lightbulb } from "lucide-react";
import { findHowTo } from "@/lib/help/how-to";

function HowToInner() {
  const pathname = usePathname();
  const tab = useSearchParams().get("tab");
  const guide = findHowTo(pathname, tab);
  if (!guide) return null;

  return (
    <details
      key={`${pathname}?${tab ?? ""}`}
      className="no-print group mb-5 rounded-xl border border-sky-200 bg-sky-50 text-slate-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-slate-200"
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 py-2 text-sm font-medium text-sky-900 dark:text-sky-200 [&::-webkit-details-marker]:hidden">
        <CircleHelp size={18} className="shrink-0" />
        <span className="min-w-0 flex-1">How to use this page — {guide.title}</span>
        <span className="shrink-0 text-xs font-normal text-sky-700 group-open:hidden dark:text-sky-300">Tap to open</span>
        <span className="hidden shrink-0 text-xs font-normal text-sky-700 group-open:inline dark:text-sky-300">Tap to close</span>
      </summary>

      <div className="space-y-4 border-t border-sky-200 px-4 py-4 text-sm leading-relaxed dark:border-sky-900">
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-50">What is this page?</p>
          <p className="mt-1">{guide.what}</p>
        </div>

        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-50">When do I use it?</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {guide.when.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>

        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-50">How do I use it?</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            {guide.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>

        {guide.tip ? (
          <p className="flex gap-2 rounded-lg bg-white/70 p-3 dark:bg-slate-900/60">
            <Lightbulb size={16} className="mt-0.5 shrink-0 text-amber-500" />
            <span>
              <span className="font-semibold">Tip: </span>
              {guide.tip}
            </span>
          </p>
        ) : null}
      </div>
    </details>
  );
}

/** A "How to use this page" box that works out which page it is on and shows the right guide. */
export function HowTo() {
  return (
    <Suspense fallback={null}>
      <HowToInner />
    </Suspense>
  );
}
