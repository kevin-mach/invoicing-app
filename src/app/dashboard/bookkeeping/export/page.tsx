import { createClient } from "@/lib/supabase/server";
import { requireBookkeeper } from "@/lib/bookkeeping/access";
import {
  getBankTransactions,
  getExpenses,
  getInvoiceLines,
  getInvoiceSummaries,
  getPosSales,
  getPurchaseSummaries,
  sumBy,
} from "@/lib/bookkeeping/data";
import { resolvePeriod } from "@/lib/bookkeeping/period";
import { computeVatWorksheet } from "@/lib/bookkeeping/vat-return";
import { totalStaffCost } from "@/lib/bookkeeping/payroll";
import { dueDateFor } from "@/lib/bookkeeping/ageing";
import { roundMoney } from "@/lib/format";
import { PeriodFilter } from "@/components/bookkeeping/period-filter";
import { ExportButtons, type ExportSheet } from "./export-buttons";

export default async function ExportPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const org = await requireBookkeeper();
  if (!org) return null;

  const params = await searchParams;
  const { from, to } = resolvePeriod(params.from, params.to, "last-quarter");

  const supabase = await createClient();
  const [invoices, lines, purchases, ws, expenses, bank, pos, { data: payRuns }] = await Promise.all([
    getInvoiceSummaries(org.orgId, { from, to, statuses: ["sent", "paid", "overdue"] }),
    getInvoiceLines(org.orgId, from, to),
    getPurchaseSummaries(org.orgId, { from, to }),
    computeVatWorksheet(org.orgId, from, to),
    getExpenses(org.orgId, from, to),
    getBankTransactions(org.orgId, { from, to }),
    getPosSales(org.orgId, from, to),
    supabase.from("pay_runs").select("*").eq("org_id", org.orgId).gte("pay_date", from).lte("pay_date", to).order("pay_date"),
  ]);

  const { sales: salesByRate, purchases: purchasesByRate, expenses: expensesByRate, box } = ws;

  const sales = roundMoney(sumBy(lines, (l) => l.net) + sumBy(pos, (p) => p.net_sales));
  const staff = roundMoney((payRuns ?? []).reduce((t, r) => t + totalStaffCost(r), 0));
  const cogs = sumBy(purchases, (p) => p.net);
  const exp = sumBy(expenses, (e) => e.net_amount);

  const sheets: ExportSheet[] = [
    {
      name: "Summary",
      rows: [
        ["Item", "Amount (£)"],
        ["Period", `${from} to ${to}`],
        ["Sales (ex VAT)", sales],
        ["Purchases (ex VAT)", cogs],
        ["Gross profit", roundMoney(sales - cogs)],
        ["Other expenses (ex VAT)", exp],
        ["Staff cost (gross + employer NI + pension)", staff],
        ["Net profit", roundMoney(sales - cogs - staff - exp)],
        ["VAT box 1 - due on sales", box.box1],
        ["VAT box 4 - reclaimed", box.box4],
        ["VAT box 5 - net to pay (negative = refund)", box.box5],
        ["VAT box 6 - sales ex VAT", box.box6],
        ["VAT box 7 - purchases & expenses ex VAT", box.box7],
      ],
    },
    {
      name: "Invoices",
      rows: [
        ["Number", "Customer", "Issued", "Due", "Status", "Total", "Paid", "Outstanding"],
        ...invoices.map((i) => [
          i.number ?? i.id.slice(0, 8),
          i.customerName,
          i.issueDate,
          dueDateFor(i.dueDate, i.issueDate),
          i.status,
          i.total,
          i.status === "paid" ? i.total : i.paid,
          i.outstanding,
        ]),
      ],
    },
    {
      name: "Sales lines",
      rows: [
        ["Date", "Invoice", "Customer", "Description", "Qty", "Unit price", "Net", "VAT rate %", "VAT"],
        ...lines.map((l) => [
          l.issueDate,
          l.invoiceNumber ?? l.invoiceId.slice(0, 8),
          l.customerName,
          l.description,
          l.qty,
          l.unitPrice,
          l.net,
          l.vatRate,
          l.vat,
        ]),
      ],
    },
    {
      name: "Supplier bills",
      rows: [
        ["Date", "Supplier", "Supplier ref", "Due", "Paid on", "Net", "VAT", "Total"],
        ...purchases.map((p) => [
          p.purchaseDate,
          p.vendorName,
          p.supplierRef ?? "",
          dueDateFor(p.dueDate, p.purchaseDate),
          p.paidOn ?? "",
          p.net,
          p.vat,
          p.gross,
        ]),
      ],
    },
    {
      name: "Expenses",
      rows: [
        ["Date", "Paid to", "Category", "Paid by", "Net", "VAT", "Total", "Notes"],
        ...expenses.map((e) => [
          e.expense_date,
          e.payee,
          e.category,
          e.payment_method,
          e.net_amount,
          e.vat_amount,
          e.total_amount ?? roundMoney(e.net_amount + e.vat_amount),
          e.description ?? "",
        ]),
      ],
    },
    {
      name: "Bank",
      rows: [
        ["Date", "Description", "Amount", "Status", "Matched to"],
        ...bank.map((b) => [b.txn_date, b.description, b.amount, b.status, b.matched_type ?? ""]),
      ],
    },
    {
      name: "POS sales",
      rows: [
        ["Date", "Source", "Location", "Gross", "Net", "VAT", "Cash", "Card", "Other", "Tips", "Refunds", "Transactions"],
        ...(await posDetail(org.orgId, from, to)),
      ],
    },
    {
      name: "Payroll",
      rows: [
        ["Pay date", "Employees", "Gross", "Employer NI", "Employer pension", "Employee NI", "Employee pension", "PAYE", "Student loan", "Net pay", "HMRC owed", "HMRC due", "HMRC paid"],
        ...(payRuns ?? []).map((r) => [r.pay_date, r.employees, r.gross_pay, r.employer_ni, r.employer_pension, r.employee_ni, r.employee_pension, r.paye, r.student_loan, r.net_pay ?? 0, r.hmrc_liability ?? 0, r.hmrc_due_date, r.hmrc_paid_on ?? ""]),
      ],
    },
    {
      name: "VAT by rate",
      rows: [
        ["Section", "VAT rate %", "Net", "VAT"],
        ...salesByRate.map((r) => ["Sales", r.rate, r.net, r.vat]),
        ...purchasesByRate.map((r) => ["Supplier bills", r.rate, r.net, r.vat]),
        ...expensesByRate.map((r) => ["Expenses", r.rate, r.net, r.vat]),
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <PeriodFilter basePath="/dashboard/bookkeeping/export" from={from} to={to} />
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Accountant pack</h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Everything for {from} to {to} in one workbook — invoices, sales lines, supplier bills, expenses, bank lines and
          the VAT worksheet — ready to hand to an accountant or import elsewhere.
        </p>
        <ExportButtons sheets={sheets} filename={`bookkeeping-${from}-to-${to}`} />
      </div>
    </div>
  );
}

async function posDetail(orgId: string, from: string, to: string): Promise<(string | number)[][]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pos_daily_sales")
    .select("sales_date, source, location, gross_sales, net_sales, vat_amount, cash_total, card_total, other_total, tips, refunds, transactions")
    .eq("org_id", orgId)
    .gte("sales_date", from)
    .lte("sales_date", to)
    .order("sales_date")
    .limit(2000);
  return (data ?? []).map((d) => [d.sales_date, d.source, d.location, d.gross_sales, d.net_sales, d.vat_amount, d.cash_total, d.card_total, d.other_total, d.tips, d.refunds, d.transactions]);
}
