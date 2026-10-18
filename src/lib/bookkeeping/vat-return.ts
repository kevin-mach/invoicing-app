import { getExpenses, getInvoiceLines, getPosSales, getPurchaseVatLines, type InvoiceLineRow } from "./data";
import { buildVatReturn, groupByRate, nearestRate, type VatReturn, type VatRow } from "./vat";

export type VatWorksheet = {
  sales: VatRow[];
  posSales: VatRow[];
  purchases: VatRow[];
  expenses: VatRow[];
  box: VatReturn;
  invoiceLines: InvoiceLineRow[];
};

/** The single place a VAT period is calculated, so the worksheet and an HMRC submission can never
 * disagree. Sales are invoices plus POS days; each POS day is snapped to its nearest UK rate. */
export async function computeVatWorksheet(orgId: string, from: string, to: string): Promise<VatWorksheet> {
  const [invoiceLines, purchaseLines, expenses, pos] = await Promise.all([
    getInvoiceLines(orgId, from, to),
    getPurchaseVatLines(orgId, from, to),
    getExpenses(orgId, from, to),
    getPosSales(orgId, from, to),
  ]);
  const invoiceSales = groupByRate(invoiceLines.map((l) => ({ rate: l.vatRate, net: l.net, vat: l.vat })));
  const posSales = groupByRate(pos.map((p) => ({ rate: nearestRate(p.net_sales, p.vat_amount), net: p.net_sales, vat: p.vat_amount })));
  const sales = groupByRate([...invoiceSales, ...posSales]);
  const purchases = groupByRate(purchaseLines);
  const expenseRows = groupByRate(expenses.map((e) => ({ rate: nearestRate(e.net_amount, e.vat_amount), net: e.net_amount, vat: e.vat_amount })));
  return { sales, posSales, purchases, expenses: expenseRows, box: buildVatReturn(sales, purchases, expenseRows), invoiceLines };
}
