"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { DateInput } from "@/components/date-input";
import { PdfShareActions } from "@/components/pdf-share-actions";
import { formatGBP } from "@/lib/format";
import { titleForKey } from "@/lib/period";
import {
  byCategory,
  byPeriod,
  filterItems,
  hasVat,
  rateLabel,
  summarise,
  totalsOf,
  type ReportFilter,
  type ReportItem,
  type SideFilter,
  type Span,
  type Totals,
  type VatFilter,
} from "@/lib/bookkeeping/report-math";

const BASE = "/dashboard/bookkeeping/reports";
const PAGE_SIZE = 200;
const href = (span: Span, date: string) => `${BASE}?span=${span}&date=${date}`;

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; text: string; sub?: string }[];
}) {
  return (
    <div role="group" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 rounded-lg px-2 py-1.5 text-center text-sm font-medium transition-colors ${
            value === o.value
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-50"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <span className="block leading-tight">{o.text}</span>
          {o.sub ? <span className="block text-[11px] font-normal leading-tight opacity-70">{o.sub}</span> : null}
        </button>
      ))}
    </div>
  );
}

function Card({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold ${tone === "bad" ? "text-red-600 dark:text-red-400" : tone === "good" ? "text-green-700 dark:text-green-400" : "text-slate-900 dark:text-slate-50"}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </div>
  );
}

/** The bookkeeper's report for a day, month, year or any chosen date: every sold item and cost, with
 * a quick switch between items that carry VAT and items that don't, totals that follow whatever is
 * switched on, and a tap-to-filter list of categories (Fish & seafood, Fuel, Fruit & veg…). */
export function ReportExplorer({
  items,
  orgName,
  span,
  date,
  from,
  to,
  prevDate,
  nextDate,
  today,
  initial,
}: {
  items: ReportItem[];
  orgName: string;
  span: Span;
  date: string;
  from: string;
  to: string;
  prevDate: string;
  nextDate: string;
  today: string;
  initial: ReportFilter;
}) {
  const [vat, setVat] = useState<VatFilter>(initial.vat);
  const [side, setSide] = useState<SideFilter>(initial.side);
  const [category, setCategory] = useState<string | null>(initial.category);
  const [shown, setShown] = useState(PAGE_SIZE);

  // Keep the switches in the address, so a refresh or a shared link shows the same view.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const set = (k: string, v: string | null) => (v ? url.searchParams.set(k, v) : url.searchParams.delete(k));
      set("vat", vat === "all" ? null : vat);
      set("side", side === "all" ? null : side);
      set("cat", category);
      window.history.replaceState(null, "", url);
    } catch {
      /* address bar is only a convenience */
    }
  }, [vat, side, category]);

  const title = titleForKey(span === "day" ? date : span === "month" ? date.slice(0, 7) : date.slice(0, 4));
  const filter: ReportFilter = { vat, side, category };
  const filtered = useMemo(() => filterItems(items, filter), [items, vat, side, category]); // eslint-disable-line react-hooks/exhaustive-deps

  // What each switch would show, given the other two, so the buttons carry their own totals.
  const vatCounts = useMemo(() => {
    const f = (v: VatFilter) => totalsOf(filterItems(items, { vat: v, side, category }));
    return { all: f("all"), vat: f("vat"), novat: f("novat") };
  }, [items, side, category]);
  const sideCounts = useMemo(() => {
    const f = (s: SideFilter) => totalsOf(filterItems(items, { vat, side: s, category }));
    return { all: f("all"), sale: f("sale"), cost: f("cost") };
  }, [items, vat, category]);

  // The category list ignores the category switch itself, so you can always pick another one.
  const categories = useMemo(() => byCategory(filterItems(items, { vat, side, category: null })), [items, vat, side]);
  const summary = useMemo(() => summarise(filtered), [filtered]);
  const totals = useMemo(() => totalsOf(filtered), [filtered]);
  const totalRows: { name: string; t: Totals }[] =
    side === "all"
      ? [
          { name: "Sales", t: summary.sales },
          { name: "Costs", t: summary.costs },
        ]
      : [{ name: side === "sale" ? "Sales" : "Costs", t: totals }];
  const periodRows = useMemo(() => (span === "day" ? [] : byPeriod(filtered, span)), [filtered, span]);

  const keyHref = (key: string) => (key.length === 10 ? href("day", key) : href("month", `${key}-01`));
  const keyLabel = (key: string) => (key.length === 10 ? titleForKey(key).replace(/ \d{4}$/, "") : titleForKey(key));
  const visible = filtered.slice(0, shown);
  const vatBalanceTone = summary.vatBalance > 0 ? "bad" : summary.vatBalance < 0 ? "good" : undefined;

  const spanLink = (s: Span, text: string) => (
    <Link
      key={s}
      href={href(s, date)}
      aria-current={span === s ? "page" : undefined}
      className={`flex min-h-11 items-center justify-center rounded-lg px-2 text-sm font-medium ${
        span === s ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-50" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
      }`}
    >
      {text}
    </Link>
  );

  return (
    <div className="space-y-4">
      {/* Which day, month or year */}
      <div className="no-print space-y-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {spanLink("day", "Day")}
          {spanLink("month", "Month")}
          {spanLink("year", "Year")}
        </div>
        <div className="flex items-center justify-between gap-2">
          <Link href={href(span, prevDate)} aria-label={`Previous ${span}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            <ChevronLeft size={20} />
          </Link>
          <div className="min-w-0 text-center">
            <p className="truncate font-semibold text-slate-900 dark:text-slate-50">{title}</p>
            {from !== today || span !== "day" ? (
              <Link href={href(span, today)} className="text-xs text-slate-500 underline dark:text-slate-400">
                Go to today
              </Link>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">Today</p>
            )}
          </div>
          <Link href={href(span, nextDate)} aria-label={`Next ${span}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            <ChevronRight size={20} />
          </Link>
        </div>
        <form method="get" action={BASE} className="flex items-end gap-2">
          <input type="hidden" name="span" value={span} />
          <div className="min-w-0 flex-1">
            <label htmlFor="report-date" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              Or pick a specific date
            </label>
            <DateInput
              id="report-date"
              name="date"
              defaultValue={date}
              required
              className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
            />
          </div>
          <button type="submit" className="min-h-11 shrink-0 rounded-md bg-slate-900 px-4 text-sm font-medium text-white dark:bg-slate-50 dark:text-slate-900">
            Show
          </button>
        </form>
      </div>

      {/* The quick switches */}
      <div className="no-print space-y-2">
        <Segmented
          label="VAT"
          value={vat}
          onChange={(v) => {
            setVat(v);
            setShown(PAGE_SIZE);
          }}
          options={[
            { value: "all", text: "All items", sub: `${vatCounts.all.count}` },
            { value: "vat", text: "With VAT", sub: `${vatCounts.vat.count}` },
            { value: "novat", text: "No VAT", sub: `${vatCounts.novat.count}` },
          ]}
        />
        <Segmented
          label="Sales or costs"
          value={side}
          onChange={(v) => {
            setSide(v);
            setShown(PAGE_SIZE);
          }}
          options={[
            { value: "all", text: "Sales & costs" },
            { value: "sale", text: "Sales", sub: `${sideCounts.sale.count}` },
            { value: "cost", text: "Costs", sub: `${sideCounts.cost.count}` },
          ]}
        />
        {category ? (
          <button
            type="button"
            onClick={() => setCategory(null)}
            className="flex min-h-11 items-center gap-2 rounded-full bg-slate-900 px-4 text-sm font-medium text-white dark:bg-slate-50 dark:text-slate-900"
          >
            Category: {category} <X size={16} aria-hidden />
            <span className="sr-only">Clear category</span>
          </button>
        ) : null}
      </div>

      <div id="bk-report" className="space-y-4 rounded-xl bg-white p-1 dark:bg-transparent print:p-0">
        <div className="px-1">
          <h2 className="font-semibold text-slate-900 dark:text-slate-50">
            {orgName} — report for {title}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Showing {vat === "all" ? "all items" : vat === "vat" ? "items with VAT" : "items with no VAT"}
            {side === "all" ? "" : side === "sale" ? ", sales only" : ", costs only"}
            {category ? `, ${category} only` : ""} — {filtered.length} of {items.length}.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Card label="Sales" value={formatGBP(summary.sales.net)} hint={`VAT ${formatGBP(summary.sales.vat)} · total ${formatGBP(summary.sales.total)}`} />
          <Card label="Costs" value={formatGBP(summary.costs.net)} hint={`VAT ${formatGBP(summary.costs.vat)} · total ${formatGBP(summary.costs.total)}`} />
          <Card label="Left over (before VAT)" value={formatGBP(summary.resultNet)} tone={summary.resultNet < 0 ? "bad" : summary.resultNet > 0 ? "good" : undefined} hint="Sales less costs" />
          <Card
            label={summary.vatBalance >= 0 ? "VAT to pay" : "VAT to reclaim"}
            value={formatGBP(Math.abs(summary.vatBalance))}
            tone={vatBalanceTone}
            hint="VAT on sales less VAT on costs"
          />
        </div>

        {/* Categories */}
        <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h3 className="font-semibold text-slate-900 dark:text-slate-50">By category</h3>
            <p className="no-print text-sm text-slate-500 dark:text-slate-400">Tap one to see just those items.</p>
          </div>
          {categories.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {categories.map((c) => (
                <li key={c.category}>
                  <button
                    type="button"
                    aria-pressed={category === c.category}
                    onClick={() => {
                      setCategory(category === c.category ? null : c.category);
                      setShown(PAGE_SIZE);
                    }}
                    className={`flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm ${
                      category === c.category ? "bg-slate-100 dark:bg-slate-800" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900 dark:text-slate-50">{c.category}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {c.count} item{c.count === 1 ? "" : "s"}
                        {side === "all" ? ` · ${c.side === "sale" ? "sales" : c.side === "cost" ? "costs" : "sales & costs"}` : ""} · VAT {formatGBP(c.vat)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-semibold text-slate-900 dark:text-slate-50">{formatGBP(c.net)}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{formatGBP(c.total)} inc VAT</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-slate-400">Nothing in this view.</p>
          )}
        </section>

        {/* Days of the month / months of the year */}
        {span !== "day" && periodRows.length ? (
          <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <h3 className="font-semibold text-slate-900 dark:text-slate-50">{span === "month" ? "Day by day" : "Month by month"}</h3>
              <p className="no-print text-sm text-slate-500 dark:text-slate-400">Tap a {span === "month" ? "day" : "month"} to open its own report.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">{span === "month" ? "Day" : "Month"}</th>
                    <th className="px-3 py-2 text-right font-medium">Sales</th>
                    <th className="px-3 py-2 text-right font-medium">Costs</th>
                    <th className="px-3 py-2 text-right font-medium">Left</th>
                  </tr>
                </thead>
                <tbody>
                  {periodRows.map((r) => (
                    <tr key={r.key} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <td className="px-3 py-2">
                        <Link href={keyHref(r.key)} className="inline-flex min-h-9 items-center text-slate-900 underline dark:text-slate-50">
                          {keyLabel(r.key)}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right">{formatGBP(r.sales)}</td>
                      <td className="px-3 py-2 text-right">{formatGBP(r.costs)}</td>
                      <td className={`px-3 py-2 text-right font-medium ${r.sales - r.costs < 0 ? "text-red-600 dark:text-red-400" : ""}`}>{formatGBP(r.sales - r.costs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {/* Every item */}
        <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h3 className="font-semibold text-slate-900 dark:text-slate-50">Items</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="lines w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Before VAT</th>
                  <th className="px-3 py-2 text-right font-medium">VAT %</th>
                  <th className="px-3 py-2 text-right font-medium">VAT</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((i) => (
                  <tr key={i.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400" data-label="Date">
                      {i.date}
                    </td>
                    <td className="px-3 py-2" data-label={`${i.side === "sale" ? "Sold to" : "From"} ${i.party}`} data-wide>
                      {i.href ? (
                        <Link href={i.href} className="font-medium text-slate-900 underline-offset-2 hover:underline dark:text-slate-50">
                          {i.description}
                        </Link>
                      ) : (
                        <span className="font-medium text-slate-900 dark:text-slate-50">{i.description}</span>
                      )}
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {i.kind} · {i.side === "sale" ? "to" : "from"} {i.party}
                      </span>
                    </td>
                    <td className="px-3 py-2" data-label="Category">
                      <button type="button" onClick={() => setCategory(i.category)} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {i.category}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right" data-label="Qty">
                      {i.qty ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right" data-label="Before VAT">
                      {formatGBP(i.net)}
                    </td>
                    <td className="px-3 py-2 text-right" data-label="VAT %">
                      <span className={hasVat(i) ? "" : "text-slate-400"}>{rateLabel(i.net, i.vat)}</span>
                    </td>
                    <td className="px-3 py-2 text-right" data-label="VAT">
                      {formatGBP(i.vat)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900 dark:text-slate-50" data-label="Total">
                      {formatGBP(i.net + i.vat)}
                    </td>
                  </tr>
                ))}
                {!visible.length ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-slate-400">
                      Nothing in this view. Try &ldquo;All items&rdquo; or pick a different {span}.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {filtered.length > visible.length ? (
            <div className="no-print border-t border-slate-200 p-3 dark:border-slate-800">
              <button type="button" onClick={() => setShown((n) => n + PAGE_SIZE)} className="min-h-11 w-full rounded-md border border-slate-300 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300">
                Show more ({filtered.length - visible.length} left)
              </button>
            </div>
          ) : null}
        </section>

        {/* Totals for what is on screen */}
        <section className="rounded-xl border border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
          <h3 className="font-semibold text-slate-900 dark:text-slate-50">Totals for what&apos;s shown</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[300px] text-left text-sm">
              <thead className="text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-1 font-medium" />
                  <th className="py-1 text-right font-medium">Items</th>
                  <th className="py-1 text-right font-medium">Before VAT</th>
                  <th className="py-1 text-right font-medium">VAT</th>
                  <th className="py-1 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-300">
                {totalRows.map(({ name, t }) => (
                  <tr key={name} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="py-1.5 font-medium text-slate-900 dark:text-slate-50">{name}</td>
                    <td className="py-1.5 text-right">{t.count}</td>
                    <td className="py-1.5 text-right">{formatGBP(t.net)}</td>
                    <td className="py-1.5 text-right">{formatGBP(t.vat)}</td>
                    <td className="py-1.5 text-right font-semibold text-slate-900 dark:text-slate-50">{formatGBP(t.total)}</td>
                  </tr>
                ))}
                {side === "all" ? (
                  <tr className="border-t border-slate-300 font-semibold text-slate-900 dark:border-slate-700 dark:text-slate-50">
                    <td className="py-1.5">Sales less costs</td>
                    <td className="py-1.5" />
                    <td className="py-1.5 text-right">{formatGBP(summary.resultNet)}</td>
                    <td className="py-1.5 text-right">{formatGBP(summary.vatBalance)}</td>
                    <td className="py-1.5 text-right">{formatGBP(summary.sales.total - summary.costs.total)}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Credit notes are already taken off. The VAT figure on the last line is VAT on sales less VAT on costs.</p>
        </section>
      </div>

      <div className="no-print">
        <PdfShareActions targetId="bk-report" filename={`report-${from}${from === to ? "" : `-to-${to}`}.pdf`} title={`Report for ${title}`} />
      </div>
    </div>
  );
}
