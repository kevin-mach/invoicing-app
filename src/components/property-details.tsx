"use client";

import { CheckCircle2, AlertTriangle } from "lucide-react";
import { DateInput } from "@/components/date-input";
import { formatGBP } from "@/lib/format";
import { propertyStatementAddsUp, type PropertyDetails } from "@/lib/property";

const field = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50";
const label = "block text-sm font-medium text-slate-700 dark:text-slate-300";

const TEXT_FIELDS: { key: "property" | "invoiceNo" | "ourRef" | "location" | "vatRegNo"; label: string; wide?: boolean }[] = [
  { key: "property", label: "Managed property at", wide: true },
  { key: "invoiceNo", label: "Invoice no." },
  { key: "ourRef", label: "Our ref" },
  { key: "location", label: "Location" },
  { key: "vatRegNo", label: "VAT reg. no." },
];
const DATE_FIELDS: { key: "currentRentDate" | "rentReviewDate" | "discussWithAgentDate"; label: string }[] = [
  { key: "currentRentDate", label: "Current rent date" },
  { key: "rentReviewDate", label: "Rent review date" },
  { key: "discussWithAgentDate", label: "Discuss with agent date" },
];
const MONEY_FIELDS: { key: "rentReceived" | "invoiceAmount" | "vatIncluded" | "expensesPaid" | "balanceDue"; label: string }[] = [
  { key: "rentReceived", label: "Rent received" },
  { key: "invoiceAmount", label: "Less our invoice (fee)" },
  { key: "vatIncluded", label: "VAT included in the fee" },
  { key: "expensesPaid", label: "Less expenses paid on your behalf" },
  { key: "balanceDue", label: "Balance due to you" },
];

/** The property section of a property company's invoice, to fill in or correct. */
export function PropertyFields({
  value,
  onChange,
  title = "Property details",
}: {
  value: PropertyDetails;
  onChange: (next: PropertyDetails) => void;
  title?: string;
}) {
  const set = <K extends keyof PropertyDetails>(key: K, v: PropertyDetails[K]) => onChange({ ...value, [key]: v });
  const adds = propertyStatementAddsUp(value);

  return (
    <fieldset className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
      <legend className="px-1 text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</legend>

      <div className="grid gap-4 sm:grid-cols-2">
        {TEXT_FIELDS.map((f) => (
          <div key={f.key} className={f.wide ? "sm:col-span-2" : ""}>
            <label className={label}>{f.label}</label>
            <input value={value[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value || null)} className={field} />
          </div>
        ))}
        <div className="sm:col-span-2">
          <label className={label}>What the invoice is for</label>
          <input value={value.description ?? ""} onChange={(e) => set("description", e.target.value || null)} className={field} placeholder="e.g. Agreed management fees for the above property inc VAT" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {DATE_FIELDS.map((f) => (
          <div key={f.key}>
            <label className={label}>{f.label}</label>
            <DateInput value={value[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value || null)} className={field} />
          </div>
        ))}
      </div>

      <div>
        <p className={label}>Statement of account</p>
        <div className="mt-1 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {MONEY_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="block text-xs text-slate-500 dark:text-slate-400">{f.label}</label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={value[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value === "" ? null : Number(e.target.value))}
                className={field}
              />
            </div>
          ))}
        </div>
        {adds !== null ? (
          <p className={`mt-2 flex items-center gap-1.5 text-xs ${adds ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}>
            {adds ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            {adds ? "Rent received − invoice − expenses equals the balance due." : "Rent received − invoice − expenses doesn't equal the balance due — check the figures."}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Balance paid to — sort code</label>
          <input value={value.paidToSortCode ?? ""} onChange={(e) => set("paidToSortCode", e.target.value || null)} className={field} />
        </div>
        <div>
          <label className={label}>Balance paid to — account number</label>
          <input value={value.paidToAccount ?? ""} onChange={(e) => set("paidToAccount", e.target.value || null)} className={field} />
        </div>
      </div>
    </fieldset>
  );
}

const fmtDate = (d: string | null) => (d ? d.split("-").reverse().join("/") : null);

/** Read-only version, for a saved purchase or a printed invoice. Shows only what is filled in. */
export function PropertyDetailsView({ details: d, title = "Property details" }: { details: PropertyDetails; title?: string }) {
  const rows: [string, string | null][] = [
    ["Managed property at", d.property],
    ["Invoice no.", d.invoiceNo],
    ["Our ref", d.ourRef],
    ["Location", d.location],
    ["VAT reg. no.", d.vatRegNo],
    ["For", d.description],
    ["Current rent date", fmtDate(d.currentRentDate)],
    ["Rent review date", fmtDate(d.rentReviewDate)],
    ["Discuss with agent date", fmtDate(d.discussWithAgentDate)],
  ];
  const money: [string, number | null][] = [
    ["Rent received", d.rentReceived],
    ["Less our invoice as above", d.invoiceAmount],
    ["  of which VAT included", d.vatIncluded],
    ["Less expenses paid on your behalf", d.expensesPaid],
    ["Balance due to you", d.balanceDue],
  ];
  const shown = rows.filter(([, v]) => v);
  const shownMoney = money.filter(([, v]) => v !== null);
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm print:border-black dark:border-slate-800 dark:bg-slate-900">
      <h2 className="font-semibold text-slate-900 dark:text-slate-50 print:text-black">{title}</h2>
      {shown.length ? (
        <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {shown.map(([k, v]) => (
            <div key={k} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 py-1 dark:border-slate-800">
              <dt className="text-slate-500 dark:text-slate-400 print:text-black">{k}</dt>
              <dd className="text-slate-900 dark:text-slate-50 print:text-black">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {shownMoney.length ? (
        <div className="mt-3">
          <p className="font-medium text-slate-700 dark:text-slate-300 print:text-black">Statement of account</p>
          <div className="mt-1 max-w-sm space-y-1">
            {shownMoney.map(([k, v]) => (
              <div key={k} className={`flex justify-between ${k === "Balance due to you" ? "border-t border-slate-200 pt-1 font-semibold dark:border-slate-800" : ""} text-slate-700 dark:text-slate-300 print:text-black`}>
                <span className="whitespace-pre">{k}</span>
                <span>{formatGBP(v as number)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {d.paidToSortCode || d.paidToAccount ? (
        <p className="mt-3 text-slate-600 dark:text-slate-400 print:text-black">
          Balance paid to account {d.paidToSortCode ?? ""} {d.paidToAccount ?? ""}
        </p>
      ) : null}
    </section>
  );
}
