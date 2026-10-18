const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

/** Formats an amount as GBP with thousands separators, e.g. 12.5 -> "£12.50",
 * 22325 -> "£22,325.00", -12.5 -> "-£12.50". */
export function formatGBP(amount: number): string {
  return gbp.format(amount === 0 ? 0 : amount); // normalises -0 so it never prints as "-£0.00"
}

/** Rounds a money amount to whole pence so summed totals never show float artifacts. */
export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Rounds a quantity to 2 decimal places, avoiding binary float artifacts like
 * 0.82 + 1 -> 1.8199999999999998 when summing or stepping quantities. */
export function roundQty(n: number): number {
  return Math.round(n * 100) / 100;
}
