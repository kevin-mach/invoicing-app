import { roundMoney } from "@/lib/format";

/** UK cash denominations, largest first. Keys are stable identifiers stored with each cash-up. */
export const DENOMINATIONS = [
  { key: "n50", label: "£50", value: 50 },
  { key: "n20", label: "£20", value: 20 },
  { key: "n10", label: "£10", value: 10 },
  { key: "n5", label: "£5", value: 5 },
  { key: "c200", label: "£2", value: 2 },
  { key: "c100", label: "£1", value: 1 },
  { key: "c50", label: "50p", value: 0.5 },
  { key: "c20", label: "20p", value: 0.2 },
  { key: "c10", label: "10p", value: 0.1 },
  { key: "c5", label: "5p", value: 0.05 },
  { key: "c2", label: "2p", value: 0.02 },
  { key: "c1", label: "1p", value: 0.01 },
] as const;

export type Denominations = Record<string, number>;

/** Total cash in a set of denomination counts. */
export function countCash(counts: Denominations): number {
  let pence = 0;
  for (const d of DENOMINATIONS) {
    const n = Math.max(0, Math.floor(Number(counts[d.key]) || 0));
    pence += n * Math.round(d.value * 100);
  }
  return pence / 100;
}

export type CashUpFigures = {
  openingFloat: number;
  expectedCashSales: number;
  paidOuts: number;
  countedCash: number;
  closingFloat: number;
};

/** What should be in the till, how far off it is (negative = short), and what goes to the bank. */
export function cashUpMath(f: CashUpFigures) {
  const expectedInTill = roundMoney(f.openingFloat + f.expectedCashSales - f.paidOuts);
  return {
    expectedInTill,
    variance: roundMoney(f.countedCash - expectedInTill),
    banked: roundMoney(f.countedCash - f.closingFloat),
  };
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function weekdayOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export type WeekdayPattern = { weekday: string; count: number; average: number; total: number };

/** Weekdays where the till is repeatedly out in the same direction — the "always £50 short on
 * Fridays" pattern. Needs at least 3 cash-ups on that weekday and an average of £10+ either way. */
export function weekdayVariancePatterns(cashUps: { cashup_date: string; variance: number | null }[]): WeekdayPattern[] {
  const byDay = new Map<string, number[]>();
  for (const c of cashUps) {
    if (c.variance === null) continue;
    const day = weekdayOf(c.cashup_date);
    byDay.set(day, [...(byDay.get(day) ?? []), c.variance]);
  }
  const patterns: WeekdayPattern[] = [];
  for (const [weekday, values] of byDay) {
    if (values.length < 3) continue;
    const total = roundMoney(values.reduce((s, v) => s + v, 0));
    const average = roundMoney(total / values.length);
    const sameDirection = values.filter((v) => Math.sign(v) === Math.sign(average) && Math.abs(v) >= 1).length;
    if (Math.abs(average) >= 10 && sameDirection / values.length >= 0.6) {
      patterns.push({ weekday, count: values.length, average, total });
    }
  }
  return patterns.sort((a, b) => a.average - b.average);
}
