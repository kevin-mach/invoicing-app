import { roundMoney } from "@/lib/format";
import type { BillExtraction, BillLine } from "./extract";

export type ReconciledBill = {
  /** Lines with `unitCost` always BEFORE VAT, which is what a purchase line stores. */
  lines: BillLine[];
  /** Whether the printed prices included VAT (and so were converted), were before VAT, or the document shows no VAT. */
  includesVat: boolean | null;
  net: number;
  vat: number;
  gross: number;
  warnings: string[];
  notices: string[];
};

const near = (a: number, b: number | null) => b !== null && Math.abs(a - b) <= 0.02;

/** Turns a scanned supplier document into before-VAT line costs. A purchase line adds VAT on top
 * of its cost, so a till receipt or an "inc VAT" invoice must have its VAT taken back out first —
 * otherwise the VAT is counted twice. Which one it is comes from the printed numbers where they can
 * say (lines add up to the net total, or to the gross total), and from the reading otherwise. */
export function reconcileBill(ex: BillExtraction): ReconciledBill {
  const warnings: string[] = [];
  const notices: string[] = [];
  const printedSum = roundMoney(ex.lines.reduce((s, l) => s + l.qty * l.unitCost, 0));

  const matchesNet = near(printedSum, ex.netTotal);
  const matchesGross = near(printedSum, ex.grossTotal);
  const hasVatInfo = ex.vatTotal !== null || ex.pricesIncludeVat !== null || ex.lines.some((l) => l.vatRate > 0);

  let includes: boolean | null = null;
  if (hasVatInfo) {
    if (matchesNet && !matchesGross) includes = false;
    else if (matchesGross && !matchesNet) includes = true;
    else includes = ex.pricesIncludeVat ?? false;
  }

  // A code like IKEA's "0" next to each price can be misread as a 0% rate while the receipt's own
  // VAT total proves VAT was charged: work the rate out from the totals instead.
  let lines = ex.lines;
  if (ex.vatTotal !== null && ex.vatTotal > 0 && lines.length && lines.every((l) => l.vatRate === 0)) {
    const base = includes ? printedSum - ex.vatTotal : printedSum;
    const implied = base > 0 ? (ex.vatTotal / base) * 100 : 0;
    const rate = [20, 5].find((r) => Math.abs(implied - r) < 1.5);
    if (rate) lines = lines.map((l) => ({ ...l, vatRate: rate }));
  }

  if (includes === true) {
    lines = lines.map((l) => {
      const gross = l.qty * l.unitCost;
      const net = gross / (1 + l.vatRate / 100);
      return { ...l, unitCost: roundMoney(net / l.qty) };
    });
  }

  // Costs are stored to the penny, so converting "6.00 incl. VAT" to 5.00 is exact but 16.00 ÷ 1.2 × 8
  // is not, and a few pence can creep into the total. Nudge one line by a few pence so the total
  // lands exactly on the printed one — the printed total is the truth.
  const totalOf = (ls: BillLine[]) =>
    roundMoney(ls.reduce((s, l) => s + l.qty * l.unitCost, 0) + ls.reduce((s, l) => s + (l.qty * l.unitCost * l.vatRate) / 100, 0));
  if (includes === true && ex.grossTotal !== null && lines.length) {
    const target = ex.grossTotal;
    let best: { drift: number; cost: number; lines: BillLine[] } = { drift: Math.abs(totalOf(lines) - target), cost: 0, lines };
    if (best.drift > 0.004) {
      for (let i = 0; i < lines.length; i++) {
        for (let d = -10; d <= 10; d++) {
          if (!d) continue;
          const candidate = lines.map((l, j) => (j === i ? { ...l, unitCost: roundMoney(l.unitCost + d / 100) } : l));
          const drift = Math.abs(totalOf(candidate) - target);
          const cost = Math.abs(d) * lines[i].qty; // pennies moved overall
          if (drift < best.drift - 0.004 || (Math.abs(drift - best.drift) <= 0.004 && cost < best.cost && best.cost > 0)) {
            best = { drift, cost, lines: candidate };
          }
        }
      }
      lines = best.lines;
    }
  }

  const net = roundMoney(lines.reduce((s, l) => s + l.qty * l.unitCost, 0));
  const vat = roundMoney(lines.reduce((s, l) => s + (l.qty * l.unitCost * l.vatRate) / 100, 0));
  const gross = roundMoney(net + vat);

  if (ex.grossTotal !== null && Math.abs(gross - ex.grossTotal) > 0.05) {
    warnings.push(`The lines come to £${gross.toFixed(2)} with VAT but the document says £${ex.grossTotal.toFixed(2)} — check the lines and VAT rates.`);
  }
  if (includes === true) {
    const i = lines.findIndex((l) => l.vatRate > 0);
    const example =
      i >= 0
        ? ` For example "${lines[i].description}" printed at £${(ex.lines[i].qty * ex.lines[i].unitCost).toFixed(2)} is £${(lines[i].qty * lines[i].unitCost).toFixed(2)} + £${((lines[i].qty * lines[i].unitCost * lines[i].vatRate) / 100).toFixed(2)} VAT.`
        : "";
    notices.push(
      `The prices on this document already include VAT. Costs are kept before VAT, so each VAT-able line's cost is the printed price with its VAT split out — the "Total inc VAT" column still matches the receipt.${example} The total is £${gross.toFixed(2)}${
        ex.grossTotal !== null ? ` (printed: £${ex.grossTotal.toFixed(2)} — a penny or two can differ from rounding)` : ""
      }.`
    );
  }

  return { lines, includesVat: includes, net, vat, gross, warnings, notices };
}
