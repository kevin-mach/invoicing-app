import { getCustomerCreditNotes, getExpenses, getInvoiceLines, getPosSales, getPurchaseVatLines, getScaleCharges, getSupplierCreditNotes, type InvoiceLineRow, type ScaleChargeRow } from "./data";
import { getVatAdjustments, type VatAdjustmentTotals } from "./bad-debts";
import { buildVatReturn, groupByRate, nearestRate, type VatReturn, type VatRow } from "./vat";

export type VatWorksheet = {
  sales: VatRow[];
  posSales: VatRow[];
  purchases: VatRow[];
  expenses: VatRow[];
  /** Fuel scale charges for cars used privately: output VAT, counted with sales. */
  scaleCharges: ScaleChargeRow[];
  /** Supplier credit notes: they reduce purchases and the VAT reclaimed (shown as negatives). */
  creditNotes: VatRow[];
  /** Credit notes given to customers: they reduce sales and the VAT due (shown as negatives). */
  customerCredits: VatRow[];
  /** Bad debt relief and the 6-month rule on unpaid bills. */
  adjustments: VatAdjustmentTotals;
  box: VatReturn;
  invoiceLines: InvoiceLineRow[];
};

/** The single place a VAT period is calculated, so the worksheet and an HMRC submission can never
 * disagree. Sales are invoices plus POS days (each POS day snapped to its nearest UK rate) plus fuel
 * scale charges; purchases are supplier bills less supplier credit notes. */
export async function computeVatWorksheet(orgId: string, from: string, to: string): Promise<VatWorksheet> {
  const [invoiceLines, purchaseLines, expenses, pos, scaleCharges, credits, customerCreditRows, adjustments] = await Promise.all([
    getInvoiceLines(orgId, from, to),
    getPurchaseVatLines(orgId, from, to),
    getExpenses(orgId, from, to),
    getPosSales(orgId, from, to),
    getScaleCharges(orgId, from, to),
    getSupplierCreditNotes(orgId, from, to),
    getCustomerCreditNotes(orgId, from, to),
    getVatAdjustments(orgId, from, to),
  ]);
  const invoiceSales = groupByRate(invoiceLines.map((l) => ({ rate: l.vatRate, net: l.net, vat: l.vat })));
  const posSales = groupByRate(pos.map((p) => ({ rate: nearestRate(p.net_sales, p.vat_amount), net: p.net_sales, vat: p.vat_amount })));
  // A scale charge is VAT-inclusive at 20%: the VAT goes in Box 1 and the rest in Box 6.
  const scaleSales = scaleCharges.map((c) => ({ rate: 20, net: c.charge - c.vat, vat: c.vat }));
  const customerCredits = groupByRate(customerCreditRows.map((c) => ({ rate: nearestRate(c.net, c.vat), net: -c.net, vat: -c.vat })));
  const sales = groupByRate([...invoiceSales, ...posSales, ...scaleSales, ...customerCredits]);
  const creditNotes = groupByRate(credits.map((c) => ({ rate: nearestRate(c.net, c.vat), net: -c.net, vat: -c.vat })));
  const purchases = groupByRate([...purchaseLines, ...creditNotes]);
  const expenseRows = groupByRate(expenses.map((e) => ({ rate: nearestRate(e.net_amount, e.vat_amount), net: e.net_amount, vat: e.vat_amount })));
  return {
    sales,
    posSales,
    purchases,
    expenses: expenseRows,
    scaleCharges,
    creditNotes,
    customerCredits,
    adjustments,
    box: buildVatReturn(sales, purchases, expenseRows, adjustments),
    invoiceLines,
  };
}
