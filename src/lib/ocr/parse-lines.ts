export type ParsedReceiptLine = {
  description: string;
  qty: number;
  unit_cost: number;
};

const PRICE_AND_QTY_LINE = /^(?:(\d+(?:\.\d+)?)\s*[xX@]?\s+)?(.+?)\s+\$?(\d+[.,]\d{2})\s*$/;
const NOISE_LINE = /^(subtotal|total|tax|change|cash|card|balance|thank you|receipt|invoice|date|tel|phone)/i;

/** Heuristic receipt-line parser: leading qty (optional), description, trailing price. */
export function parseReceiptLines(rawText: string): ParsedReceiptLine[] {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const rows: ParsedReceiptLine[] = [];

  for (const line of lines) {
    if (NOISE_LINE.test(line)) continue;

    const match = line.match(PRICE_AND_QTY_LINE);
    if (!match) continue;

    const [, qtyRaw, descriptionRaw, priceRaw] = match;
    const description = descriptionRaw.trim();
    if (!description || description.length < 2) continue;

    const unit_cost = Number(priceRaw.replace(",", "."));
    const qty = qtyRaw ? Number(qtyRaw) : 1;

    if (!Number.isFinite(unit_cost) || unit_cost <= 0) continue;

    rows.push({ description, qty: Number.isFinite(qty) && qty > 0 ? qty : 1, unit_cost });
  }

  return rows;
}
