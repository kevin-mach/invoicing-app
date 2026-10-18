import { parseBankAmount, parseBankDate } from "./bank-csv";

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Finds, for each field, the first header whose normalised name matches one of its aliases. */
export function detectColumns<K extends string>(headers: string[], aliases: Record<K, string[]>): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  const used = new Set<string>();
  for (const key of Object.keys(aliases) as K[]) {
    const hit = headers.find((h) => !used.has(h) && aliases[key].includes(norm(h)));
    if (hit) {
      out[key] = hit;
      used.add(hit);
    }
  }
  return out;
}

export function numberCell(row: Record<string, string>, col?: string): number {
  if (!col) return 0;
  const raw = (row[col] ?? "").toString().trim();
  if (!raw) return 0;
  const n = parseBankAmount(raw);
  return Number.isFinite(n) ? n : 0;
}

export function dateCell(row: Record<string, string>, col?: string): string | null {
  if (!col) return null;
  return parseBankDate((row[col] ?? "").toString());
}
