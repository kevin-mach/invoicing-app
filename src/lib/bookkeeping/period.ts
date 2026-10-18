export type PeriodPreset = { key: string; label: string; from: string; to: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Last day of the given month (month is 0-based). */
function endOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

export function periodPresets(today: Date = new Date()): PeriodPreset[] {
  const y = today.getFullYear();
  const m = today.getMonth();
  const q = Math.floor(m / 3);

  const thisMonth = { from: toIsoDate(new Date(y, m, 1)), to: toIsoDate(endOfMonth(y, m)) };
  const lastMonth = { from: toIsoDate(new Date(y, m - 1, 1)), to: toIsoDate(endOfMonth(y, m - 1)) };
  const thisQuarter = { from: toIsoDate(new Date(y, q * 3, 1)), to: toIsoDate(endOfMonth(y, q * 3 + 2)) };
  const lastQuarter = {
    from: toIsoDate(new Date(y, (q - 1) * 3, 1)),
    to: toIsoDate(endOfMonth(y, (q - 1) * 3 + 2)),
  };
  const thisYear = { from: `${y}-01-01`, to: `${y}-12-31` };
  const lastYear = { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };

  return [
    { key: "this-month", label: "This month", ...thisMonth },
    { key: "last-month", label: "Last month", ...lastMonth },
    { key: "this-quarter", label: "This quarter", ...thisQuarter },
    { key: "last-quarter", label: "Last quarter", ...lastQuarter },
    { key: "this-year", label: "This year", ...thisYear },
    { key: "last-year", label: "Last year", ...lastYear },
  ];
}

/** Reads ?from & ?to (yyyy-mm-dd); falls back to `defaultKey` preset, swapping if reversed. */
export function resolvePeriod(
  fromParam: string | undefined,
  toParam: string | undefined,
  defaultKey = "this-month",
  today: Date = new Date()
): { from: string; to: string } {
  const presets = periodPresets(today);
  const fallback = presets.find((p) => p.key === defaultKey) ?? presets[0];
  let from = fromParam && ISO_DATE.test(fromParam) ? fromParam : fallback.from;
  let to = toParam && ISO_DATE.test(toParam) ? toParam : fallback.to;
  if (from > to) [from, to] = [to, from];
  return { from, to };
}
