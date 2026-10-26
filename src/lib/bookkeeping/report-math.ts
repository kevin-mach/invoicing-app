import { roundMoney } from "@/lib/format";
import { addDays } from "./ageing";
import { rangeForPeriod } from "@/lib/period";

/** One line of the bookkeeper's period report: a sold item or a cost, with its VAT. Credit notes
 * are negative, so totals come out right without special cases. */
export type ReportItem = {
  id: string;
  date: string;
  /** Money coming in (a sale) or going out (a cost). */
  side: "sale" | "cost";
  kind: "Invoice" | "POS" | "Purchase" | "Expense" | "Receipt" | "Fuel" | "Credit note";
  description: string;
  /** The customer or supplier. */
  party: string;
  /** What kind of thing it is: Fish & seafood, Fuel, Fruit & veg… */
  category: string;
  qty: number | null;
  net: number;
  vat: number;
  href?: string;
};

export type VatFilter = "all" | "vat" | "novat";
export type SideFilter = "all" | "sale" | "cost";
export type Span = "day" | "month" | "year";

export type ReportFilter = { vat: VatFilter; side: SideFilter; category: string | null };

export type Totals = { count: number; net: number; vat: number; total: number };

/** Whether an item carries VAT. Anything with VAT on it counts — including part-reclaimable fuel,
 * whose VAT is not a clean 20% of its net. */
export const hasVat = (i: Pick<ReportItem, "vat">) => Math.abs(i.vat) >= 0.005;

export function filterItems(items: ReportItem[], f: ReportFilter): ReportItem[] {
  return items.filter(
    (i) =>
      (f.side === "all" || i.side === f.side) &&
      (f.vat === "all" || (f.vat === "vat" ? hasVat(i) : !hasVat(i))) &&
      (f.category === null || i.category === f.category)
  );
}

export function totalsOf(items: ReportItem[]): Totals {
  const net = roundMoney(items.reduce((s, i) => s + i.net, 0));
  const vat = roundMoney(items.reduce((s, i) => s + i.vat, 0));
  return { count: items.length, net, vat, total: roundMoney(net + vat) };
}

export type Summary = { sales: Totals; costs: Totals; resultNet: number; vatBalance: number };

/** Sales against costs: what is left before VAT, and the VAT balance (collected less reclaimable). */
export function summarise(items: ReportItem[]): Summary {
  const sales = totalsOf(items.filter((i) => i.side === "sale"));
  const costs = totalsOf(items.filter((i) => i.side === "cost"));
  return { sales, costs, resultNet: roundMoney(sales.net - costs.net), vatBalance: roundMoney(sales.vat - costs.vat) };
}

export type CategoryRow = Totals & { category: string; side: "sale" | "cost" | "mixed" };

/** Totals per category, biggest first. A name used on both sides (sales and costs) is one row. */
export function byCategory(items: ReportItem[]): CategoryRow[] {
  const map = new Map<string, ReportItem[]>();
  for (const i of items) {
    const list = map.get(i.category);
    if (list) list.push(i);
    else map.set(i.category, [i]);
  }
  return [...map.entries()]
    .map(([category, list]) => {
      const sides = new Set(list.map((i) => i.side));
      return { category, side: sides.size > 1 ? ("mixed" as const) : list[0].side, ...totalsOf(list) };
    })
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net) || a.category.localeCompare(b.category));
}

export type PeriodBreakdownRow = { key: string; sales: number; costs: number; salesVat: number; costsVat: number; count: number };

/** A month broken down by day, or a year by month — so the whole period can be browsed. */
export function byPeriod(items: ReportItem[], span: Exclude<Span, "day">): PeriodBreakdownRow[] {
  const map = new Map<string, PeriodBreakdownRow>();
  for (const i of items) {
    const key = span === "month" ? i.date : i.date.slice(0, 7);
    const row = map.get(key) ?? { key, sales: 0, costs: 0, salesVat: 0, costsVat: 0, count: 0 };
    if (i.side === "sale") {
      row.sales = roundMoney(row.sales + i.net);
      row.salesVat = roundMoney(row.salesVat + i.vat);
    } else {
      row.costs = roundMoney(row.costs + i.net);
      row.costsVat = roundMoney(row.costsVat + i.vat);
    }
    row.count += 1;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
}

/** The VAT rate to show for an item. A standard rate when the figures say so, else the real figure
 * (fuel where only part of the VAT is reclaimable is neither 0% nor 20%). */
export function rateLabel(net: number, vat: number): string {
  if (Math.abs(vat) < 0.005) return "0%";
  if (Math.abs(net) < 0.005) return "—";
  const implied = (vat / net) * 100;
  const standard = [20, 5].find((r) => Math.abs(implied - r) < 0.6);
  return standard ? `${standard}%` : `${implied.toFixed(1)}%`;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** A date from the URL, or null if it isn't a real calendar date. */
export function cleanDate(v: string | undefined): string | null {
  if (!v || !ISO.test(v)) return null;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? v : null;
}

export function cleanSpan(v: string | undefined): Span {
  return v === "month" || v === "year" ? v : "day";
}

/** The first and last day of the day, month or year the date falls in. */
export function spanRange(span: Span, date: string): { from: string; to: string } {
  return rangeForPeriod(span === "day" ? date : span === "month" ? date.slice(0, 7) : date.slice(0, 4));
}

/** The date to look at after stepping one day, month or year forwards or back. */
export function shiftDate(span: Span, date: string, dir: 1 | -1): string {
  if (span === "day") return addDays(date, dir);
  const [y, m] = date.split("-").map(Number);
  if (span === "month") {
    const t = new Date(Date.UTC(y, m - 1 + dir, 1));
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-01`;
  }
  return `${y + dir}-01-01`;
}
