import { roundMoney } from "@/lib/format";
import type { ReceiptExtraction } from "./extract";

export type ReconciledLine = {
  description: string;
  qty: number;
  vatRate: number;
  category: string | null;
  itemGroup: string | null;
  isStock: boolean;
  net: number;
  vat: number;
  gross: number;
};

export type ReconciledReceipt = {
  lines: ReconciledLine[];
  net: number;
  vat: number;
  gross: number;
  /** Problems the person must look at before trusting the figures — these stop auto-save. */
  warnings: string[];
  /** Worth knowing, but nothing is wrong. */
  notices: string[];
};

const cents = (n: number) => Math.round(n * 100);

/** Spreads `target` pence of VAT over a rate group so the line figures add up exactly to it. */
function allocate(group: { net: number; vat: number }[], targetVat: number) {
  const diff = cents(targetVat) - group.reduce((s, l) => s + cents(l.vat), 0);
  if (!diff || !group.length) return;
  const biggest = group.reduce((a, b) => (Math.abs(b.net) > Math.abs(a.net) ? b : a));
  biggest.vat = roundMoney(biggest.vat + diff / 100);
}

/** Turns what was read off a receipt into consistent net / VAT / gross figures per line and in
 * total. Line prices may be before or after VAT depending on the receipt; where the receipt prints
 * its own VAT table, those exact VAT amounts are used so rounding never drifts from the paper. */
/** Whether the line prices already include VAT, worked out from the printed numbers rather than
 * taken on trust: if the lines add up to the ex-VAT total they are before VAT; if they add up to
 * the final total they include it. Falls back to the reading only when the numbers can't say. */
function inferIncludesVat(ex: ReceiptExtraction): boolean | null {
  const hasVatInfo = ex.vatSummary.length > 0 || ex.vatTotal !== null || ex.lines.some((l) => l.vatRate !== null);
  if (!hasVatInfo) return null;
  const sum = ex.lines.reduce((s, l) => s + l.amount, 0);
  const near = (a: number, b: number | null) => b !== null && Math.abs(a - b) <= 0.02;
  const tableNet = ex.vatSummary.length && ex.vatSummary.every((r) => r.net !== null) ? ex.vatSummary.reduce((s, r) => s + (r.net ?? 0), 0) : null;
  const matchesNet = near(sum, ex.netTotal) || near(sum, tableNet);
  const matchesGross = near(sum, ex.grossTotal);
  if (matchesNet && !matchesGross) return false;
  if (matchesGross && !matchesNet) return true;
  return ex.pricesIncludeVat;
}

export function reconcileReceipt(ex: ReceiptExtraction): ReconciledReceipt {
  const warnings: string[] = [];
  const notices: string[] = [];
  const includes = inferIncludesVat(ex);

  const lines: ReconciledLine[] = ex.lines.map((l) => {
    const rate = l.vatRate ?? 0;
    let net: number;
    let vat: number;
    let gross: number;
    if (includes === true) {
      gross = l.amount;
      net = roundMoney(gross / (1 + rate / 100));
      vat = roundMoney(gross - net);
    } else if (includes === false) {
      net = l.amount;
      vat = roundMoney((net * rate) / 100);
      gross = roundMoney(net + vat);
    } else {
      gross = l.amount;
      net = l.amount;
      vat = 0;
    }
    return { description: l.description, qty: l.qty, vatRate: rate, category: l.category, itemGroup: l.itemGroup, isStock: l.isStock, net, vat, gross };
  });

  if (includes !== null && ex.vatSummary.length) {
    for (const row of ex.vatSummary) {
      if (row.vat === null) continue;
      const group = lines.filter((l) => l.vatRate === row.rate);
      if (group.length) allocate(group, row.vat);
    }
    for (const l of lines) l.gross = includes ? l.gross : roundMoney(l.net + l.vat);
    if (includes) for (const l of lines) l.net = roundMoney(l.gross - l.vat);
  }

  if (includes === null) {
    notices.push("This receipt doesn't print any VAT, so VAT is recorded as £0.00. If you know the VAT (for example 20% on clothing), set it on the lines.");
  } else if (ex.lines.some((x) => x.vatRate === null)) {
    warnings.push("Some lines had no VAT code that could be read, so they're set to 0% VAT — check them.");
  }

  const net = roundMoney(lines.reduce((s, l) => s + l.net, 0));
  const vat = roundMoney(lines.reduce((s, l) => s + l.vat, 0));
  const gross = roundMoney(lines.reduce((s, l) => s + l.gross, 0));

  const check = (label: string, ours: number, printed: number | null) => {
    if (printed !== null && Math.abs(ours - printed) > 0.02) {
      warnings.push(`The lines add up to ${label} £${ours.toFixed(2)} but the receipt says £${printed.toFixed(2)} — a line may have been missed or misread.`);
    }
  };
  check("a total of", gross, ex.grossTotal);
  if (includes !== null) {
    check("£net", net, ex.netTotal);
    check("VAT of", vat, ex.vatTotal);
  }
  if (!lines.length) warnings.push("No item lines could be read from this photo.");

  return { lines, net, vat, gross, warnings, notices };
}
