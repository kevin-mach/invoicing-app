"use client";

import { useState } from "react";
import { btnPrimary, btnSecondary } from "./ui";

export type NewEntry = {
  key: string;
  kind: "Supplier" | "Customer" | "Item";
  label: string;
  detail?: string;
};

/** Shown whenever a scan turns up a supplier, customer or item that isn't in the database yet.
 * Nothing is created until the person ticks what they want and presses the button. */
export function NewEntriesPrompt({
  entries,
  busy,
  error,
  onAccept,
  onSkip,
}: {
  entries: NewEntry[];
  busy: boolean;
  error: string | null;
  onAccept: (selectedKeys: string[]) => void;
  onSkip: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(entries.map((e) => e.key)));

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
      <p className="font-semibold text-amber-900 dark:text-amber-200">Add these to your database?</p>
      <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
        The photo mentions {entries.length === 1 ? "something" : "things"} that {entries.length === 1 ? "isn't" : "aren't"} saved yet. Tick
        what you want added — nothing is created until you confirm.
      </p>

      <ul className="mt-3 space-y-2">
        {entries.map((e) => (
          <li key={e.key}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-amber-200 bg-white px-3 py-2 dark:border-amber-900 dark:bg-slate-900">
              <input type="checkbox" checked={selected.has(e.key)} onChange={() => toggle(e.key)} className="h-5 w-5 shrink-0" />
              <span className="min-w-0 flex-1 text-sm">
                <span className="block break-words font-medium text-slate-900 dark:text-slate-50">{e.label}</span>
                {e.detail ? <span className="block text-xs text-slate-500 dark:text-slate-400">{e.detail}</span> : null}
              </span>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                New {e.kind.toLowerCase()}
              </span>
            </label>
          </li>
        ))}
      </ul>

      {error ? <p className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p> : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={busy || selected.size === 0}
          onClick={() => onAccept([...selected])}
          className={`${btnPrimary} min-h-11 w-full sm:w-auto`}
        >
          {busy ? "Adding..." : `Add ${selected.size} to my database`}
        </button>
        <button type="button" disabled={busy} onClick={onSkip} className={`${btnSecondary} min-h-11 w-full sm:w-auto`}>
          Skip — don&apos;t add
        </button>
      </div>
      <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
        Skipping fills in the form with one-off lines for you to check — it won&apos;t save automatically.
      </p>
    </div>
  );
}
