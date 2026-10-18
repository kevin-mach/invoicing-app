/** Matches a name read off a photo against the org's item catalogue — used to turn a scanned
 * stock count or order list into real catalogue items instead of one-off text rows. Deliberately
 * conservative: an exact name match always wins; short of that, it only accepts a fuzzy match
 * when one candidate is clearly the best (never guesses between two similarly-close items). */

export type CatalogItem = { id: string; name: string };

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Words that describe how something is sold rather than what it is — ignored when comparing.
const NOISE = new Set(["per", "kg", "ltr", "litre", "litres", "each", "pack", "pk"]);
const tokens = (s: string) => normalise(s).split(" ").filter((t) => t.length > 2 && !NOISE.has(t));

// Company-form words a supplier name may or may not carry ("Fresh Fields Produce Ltd").
const COMPANY_WORDS = /\b(ltd|limited|plc|llp|uk|co|company|the)\b/g;
const vendorKey = (s: string) => normalise(s).replace(COMPANY_WORDS, " ").replace(/\s+/g, " ").trim();

/** Exact match on a supplier name, ignoring case, punctuation and "Ltd"/"Limited"-style endings.
 * Never fuzzy beyond that: a bill saved against the wrong supplier is worse than one left unset. */
export function matchVendor<T extends CatalogItem>(name: string, vendors: T[]): T | null {
  const key = vendorKey(name);
  if (!key) return null;
  const hits = vendors.filter((v) => vendorKey(v.name) === key);
  return hits.length === 1 ? hits[0] : null;
}

export function matchCatalogItem<T extends CatalogItem>(description: string, catalog: T[]): T | null {
  const target = normalise(description);
  if (!target) return null;

  const exact = catalog.find((i) => normalise(i.name) === target);
  if (exact) return exact;

  const targetTokens = new Set(tokens(description));
  if (!targetTokens.size) return null;

  let best: T | null = null;
  let bestScore = 0;
  let tied = false;
  for (const item of catalog) {
    const itemTokens = tokens(item.name);
    if (!itemTokens.length) continue;
    const overlap = itemTokens.filter((t) => targetTokens.has(t)).length;
    const score = overlap / Math.max(itemTokens.length, targetTokens.size);
    if (score > bestScore) {
      best = item;
      bestScore = score;
      tied = false;
    } else if (score === bestScore && score > 0) {
      tied = true;
    }
  }
  return !tied && bestScore >= 0.5 ? best : null;
}
