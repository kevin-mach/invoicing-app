/** Searching a list by whatever a person types: names, numbers, status, amounts and dates.
 * Every word typed has to match something on the row, so "riverside oct" finds Riverside's
 * October rows. */

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function monthOf(word: string): number | null {
  if (word.length < 3) return null;
  const i = MONTHS.findIndex((m) => m.startsWith(word));
  return i >= 0 ? i + 1 : null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Does one typed word describe this ISO date (yyyy-mm-dd)? Understands 19/10/2026, 19/10, 10/2026,
 * 2026-10-19, 2026-10, a year, and month names like "oct" or "october". */
export function dateMatches(word: string, iso: string): boolean {
  if (!iso) return false;
  const [y, m, d] = iso.split("-");
  const w = word.toLowerCase();

  let hit = w.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (hit) return iso === `${hit[3]}-${pad(Number(hit[2]))}-${pad(Number(hit[1]))}`;
  hit = w.match(/^(\d{1,2})[/.\-](\d{1,2})$/);
  if (hit) return m === pad(Number(hit[2])) && d === pad(Number(hit[1]));
  hit = w.match(/^(\d{1,2})[/.\-](\d{4})$/);
  if (hit) return y === hit[2] && m === pad(Number(hit[1]));
  if (/^\d{4}(-\d{1,2}){0,2}$/.test(w)) return iso.startsWith(w.split("-").map((p, i) => (i === 0 ? p : pad(Number(p)))).join("-"));
  const month = monthOf(w);
  if (month !== null) return Number(m) === month;
  return false;
}

export type Searchable = {
  /** Names, numbers, statuses — anything typed as words. */
  text: (string | null | undefined)[];
  /** The row's date as yyyy-mm-dd. */
  date?: string | null;
  /** Money amounts on the row, so a total like 22325 or 1,204.50 can be found. */
  amounts?: number[];
};

/** True when every word in `query` matches something on the row. An empty query matches everything. */
export function matchesSearch(query: string, row: Searchable): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = row.text.filter((t): t is string => !!t).map((t) => t.toLowerCase());
  return words.every((word) => {
    if (text.some((t) => t.includes(word))) return true;
    if (row.date && dateMatches(word, row.date)) return true;
    const num = word.replace(/[£,]/g, "");
    if (row.amounts?.length && /^\d+(\.\d+)?$/.test(num)) {
      return row.amounts.some((a) => a.toFixed(2).includes(num) || String(a).includes(num));
    }
    return false;
  });
}

/** Keeps a yyyy-mm-dd value from the address bar, or drops anything else. */
export function cleanDate(v: string | undefined): string {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
}
