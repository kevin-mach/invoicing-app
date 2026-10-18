export const AGEING_BUCKETS = ["Not yet due", "1–30 days", "31–60 days", "61–90 days", "90+ days"] as const;

/** Default payment terms when an invoice or bill has no explicit due date. */
export const DEFAULT_TERMS_DAYS = 30;

function utcMidnight(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  return Math.round((utcMidnight(to) - utcMidnight(from)) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  const d = new Date(utcMidnight(date) + days * 86_400_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function dueDateFor(dueDate: string | null, baseDate: string, termsDays = DEFAULT_TERMS_DAYS): string {
  return dueDate ?? addDays(baseDate, termsDays);
}

/** 0 = not yet due, 1 = 1-30 days overdue, 2 = 31-60, 3 = 61-90, 4 = 90+. */
export function bucketIndex(due: string, today: string): number {
  const overdue = daysBetween(due, today);
  if (overdue <= 0) return 0;
  if (overdue <= 30) return 1;
  if (overdue <= 60) return 2;
  if (overdue <= 90) return 3;
  return 4;
}
