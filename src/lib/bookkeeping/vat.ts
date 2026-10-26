import { roundMoney } from "@/lib/format";
import { VAT_RATES } from "./categories";

export type VatInput = { rate: number; net: number; vat: number };
export type VatRow = { rate: number; net: number; vat: number };

/** Snaps an arbitrary implied rate (VAT ÷ net) to the nearest standard UK rate. */
export function nearestRate(net: number, vat: number): number {
  if (net <= 0 || vat <= 0) return 0;
  const implied = (vat / net) * 100;
  return VAT_RATES.reduce((best, r) => (Math.abs(r - implied) < Math.abs(best - implied) ? r : best), 0 as number);
}

export function groupByRate(rows: VatInput[]): VatRow[] {
  const map = new Map<number, VatRow>();
  for (const r of rows) {
    const rate = Number(r.rate) || 0;
    const cur = map.get(rate) ?? { rate, net: 0, vat: 0 };
    cur.net = roundMoney(cur.net + r.net);
    cur.vat = roundMoney(cur.vat + r.vat);
    map.set(rate, cur);
  }
  return [...map.values()].sort((a, b) => b.rate - a.rate);
}

export type VatReturn = {
  box1: number; // VAT due on sales
  box4: number; // VAT reclaimed on purchases and expenses
  box5: number; // net VAT to pay (negative = refund due)
  box6: number; // total sales excluding VAT
  box7: number; // total purchases and expenses excluding VAT
};

/** Adjustments that change the VAT boxes without being sales or purchases (bad debt relief, the
 * 6-month rule on unpaid bills). */
export type VatBoxAdjustments = { box1: number; box4: number };

export function buildVatReturn(sales: VatRow[], purchases: VatRow[], expenses: VatRow[], adjustments: VatBoxAdjustments = { box1: 0, box4: 0 }): VatReturn {
  const sum = (rows: VatRow[], pick: (r: VatRow) => number) => roundMoney(rows.reduce((s, r) => s + pick(r), 0));
  const box1 = roundMoney(sum(sales, (r) => r.vat) + adjustments.box1);
  const box4 = roundMoney(sum(purchases, (r) => r.vat) + sum(expenses, (r) => r.vat) + adjustments.box4);
  return {
    box1,
    box4,
    box5: roundMoney(box1 - box4),
    box6: sum(sales, (r) => r.net),
    box7: roundMoney(sum(purchases, (r) => r.net) + sum(expenses, (r) => r.net)),
  };
}
