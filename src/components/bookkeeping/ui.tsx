/** Small shared pieces reused across the bookkeeping module's pages and forms (Overview, Payroll,
 * POS, Stock, Cash-up, Connections, VAT…), so a stat tile or a save-status message looks and
 * behaves the same everywhere instead of each page redefining its own copy. */

// Full-size form fields (a create form's own inputs — date, payee, amount…).
export const inputClass =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50";
export const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300";
// Compact fields used inline in a table row's expanded action area.
export const rowInputClass =
  "rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50";
export const rowSelectClass = rowInputClass;

export const btnPrimary =
  "rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-50 dark:text-slate-900";
export const btnSecondary =
  "rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";
// Compact variants for inline row actions (e.g. "Mark paid", "Undo").
export const rowBtnPrimary =
  "rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-50 dark:text-slate-900";
export const rowBtnSecondary =
  "rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

export type FormStatus = { ok: boolean; text: string } | null;

/** The save-result line under a form or action button: green on success, red on failure. */
export function FormNote({ note, className = "mt-3 text-sm" }: { note: FormStatus; className?: string }) {
  if (!note) return null;
  return <p className={`${className} ${note.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{note.text}</p>;
}

export type StatTone = "good" | "bad" | "warn";

const TONE_CLASS: Record<StatTone, string> = {
  good: "text-green-600 dark:text-green-400",
  bad: "text-red-600 dark:text-red-400",
  warn: "text-amber-600 dark:text-amber-400",
};

/** The label/value/hint tile used at the top of every bookkeeping page. */
export function StatCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: StatTone }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${tone ? TONE_CLASS[tone] : "text-slate-900 dark:text-slate-50"}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </div>
  );
}
