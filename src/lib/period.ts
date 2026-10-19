/** Day / month / year periods: turning a period key into a date range and a readable title, and
 * grouping dated rows by period. A key is "2026-10-19" (day), "2026-10" (month) or "2026" (year). */

export type Group = "none" | "day" | "month" | "year";

export function cleanGroup(v: string | undefined): Group {
  return v === "day" || v === "month" || v === "year" ? v : "none";
}

export function groupKey(date: string, group: Exclude<Group, "none">): string {
  return group === "day" ? date : group === "month" ? date.slice(0, 7) : date.slice(0, 4);
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const pad = (n: number) => String(n).padStart(2, "0");

/** First and last day (yyyy-mm-dd) covered by a period key. */
export function rangeForPeriod(key: string): { from: string; to: string } {
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return { from: key, to: key };
  if (/^\d{4}-\d{2}$/.test(key)) {
    const [y, m] = key.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from: `${key}-01`, to: `${key}-${pad(last)}` };
  }
  return { from: `${key}-01-01`, to: `${key}-12-31` };
}

/** A readable title for a date range, e.g. "Monday 19 October 2026", "October 2026", "2026". */
export function titleForRange(from: string, to: string): string {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  if (from === to) {
    const dow = DAY_NAMES[new Date(Date.UTC(fy, fm - 1, fd)).getUTCDay()];
    return `${dow} ${fd} ${MONTH_NAMES[fm - 1]} ${fy}`;
  }
  const lastOfMonth = new Date(Date.UTC(fy, fm, 0)).getUTCDate();
  if (fy === ty && fm === tm && fd === 1 && td === lastOfMonth) return `${MONTH_NAMES[fm - 1]} ${fy}`;
  if (fy === ty && fm === 1 && fd === 1 && tm === 12 && td === 31) return String(fy);
  return `${fd} ${MONTH_NAMES[fm - 1]} ${fy} to ${td} ${MONTH_NAMES[tm - 1]} ${ty}`;
}

export function titleForKey(key: string): string {
  const { from, to } = rangeForPeriod(key);
  return titleForRange(from, to);
}

export function periodReportHref(key: string): string {
  const { from, to } = rangeForPeriod(key);
  return `/dashboard/reports/period?from=${from}&to=${to}`;
}

/** Groups rows by day, month or year, newest group first. */
export function groupRows<T>(rows: T[], dateOf: (row: T) => string, group: Exclude<Group, "none">): { key: string; title: string; rows: T[] }[] {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = groupKey(dateOf(row), group);
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, list]) => ({ key, title: titleForKey(key), rows: list }));
}
