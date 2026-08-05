/** Formats an amount as GBP, e.g. 12.5 -> "£12.50", -12.5 -> "-£12.50". */
export function formatGBP(amount: number): string {
  return amount < 0 ? `-£${Math.abs(amount).toFixed(2)}` : `£${amount.toFixed(2)}`;
}
