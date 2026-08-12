/** Formats an amount as GBP, e.g. 12.5 -> "£12.50", -12.5 -> "-£12.50". */
export function formatGBP(amount: number): string {
  return amount < 0 ? `-£${Math.abs(amount).toFixed(2)}` : `£${amount.toFixed(2)}`;
}

/** Rounds a quantity to 2 decimal places, avoiding binary float artifacts like
 * 0.82 + 1 -> 1.8199999999999998 when summing or stepping quantities. */
export function roundQty(n: number): number {
  return Math.round(n * 100) / 100;
}
