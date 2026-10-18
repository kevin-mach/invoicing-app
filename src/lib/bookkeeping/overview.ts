import { createClient } from "@/lib/supabase/server";
import { addDays, daysBetween, dueDateFor } from "./ageing";
import { getBankTransactions, getExpenses, getInvoiceLines, getInvoiceSummaries, getPosSales, getPurchaseLines, getPurchaseSummaries, sumBy } from "./data";
import { buildExceptions, type BookkeepingException } from "./exceptions";
import { buildOpsExceptions } from "./ops-exceptions";
import { isProcessorDeposit } from "./pos";
import { totalStaffCost } from "./payroll";
import { roundMoney } from "@/lib/format";

export type OverviewStats = {
  sales: number;
  salesIncludesPos: boolean;
  purchases: number;
  expenses: number;
  staff: number;
  profit: number;
  moneyIn: number;
  moneyOut: number;
  owedToYou: number;
  overdueToYou: number;
  youOwe: number;
  overdueYouOwe: number;
  exceptions: BookkeepingException[];
};

/** Everything the Bookkeeping Overview page renders, in one call. Pulled out of the page component
 * so the page stays render-only and this query set can be reused (e.g. by a future digest email). */
export async function getOverviewData(orgId: string, from: string, to: string, today: string): Promise<OverviewStats> {
  const supabase = await createClient();

  const [
    periodLines,
    periodPurchases,
    periodExpenses,
    periodBank,
    openInvoices,
    recentPurchases,
    purchaseLines,
    recentLines,
    unreviewed,
    posPeriod,
    payRunsAll,
    cashUps,
    wastage,
    connections,
    posRecent,
    recentBank,
  ] = await Promise.all([
    getInvoiceLines(orgId, from, to),
    getPurchaseSummaries(orgId, { from, to }),
    getExpenses(orgId, from, to),
    getBankTransactions(orgId, { from, to }),
    getInvoiceSummaries(orgId, { statuses: ["sent", "overdue"] }),
    getPurchaseSummaries(orgId, { recentOrUnpaidSince: addDays(today, -200) }),
    getPurchaseLines(orgId, addDays(today, -120)),
    getInvoiceLines(orgId, addDays(today, -90), today),
    supabase.from("bank_transactions").select("txn_date", { count: "exact" }).eq("org_id", orgId).eq("status", "unreviewed").order("txn_date").limit(1),
    getPosSales(orgId, from, to),
    supabase
      .from("pay_runs")
      .select("id, pay_date, hmrc_due_date, hmrc_paid_on, hmrc_liability, gross_pay, employer_ni, employer_pension")
      .eq("org_id", orgId)
      .gte("pay_date", addDays(today, -400)),
    supabase.from("cash_ups").select("cashup_date, variance").eq("org_id", orgId).gte("cashup_date", addDays(today, -90)),
    supabase.from("wastage_logs").select("logged_on, cost").eq("org_id", orgId).gte("logged_on", addDays(today, -60)),
    supabase.from("integration_connections").select("provider, status, last_error, last_synced_at").eq("org_id", orgId),
    supabase.from("pos_daily_sales").select("sales_date, card_total").eq("org_id", orgId).gte("sales_date", addDays(today, -60)).lte("sales_date", addDays(today, -3)),
    supabase.from("bank_transactions").select("description, amount").eq("org_id", orgId).gt("amount", 0).gte("txn_date", addDays(today, -60)).limit(2000),
  ]);

  const sales = roundMoney(sumBy(periodLines, (l) => l.net) + sumBy(posPeriod, (p) => p.net_sales));
  const staff = roundMoney((payRunsAll.data ?? []).filter((r) => r.pay_date >= from && r.pay_date <= to).reduce((sum, r) => sum + totalStaffCost(r), 0));
  const purchases = sumBy(periodPurchases, (p) => p.net);
  const expenses = sumBy(periodExpenses, (e) => e.net_amount);
  const profit = roundMoney(sales - purchases - expenses - staff);
  const moneyIn = sumBy(periodBank.filter((b) => b.status !== "ignored" && b.amount > 0), (b) => b.amount);
  const moneyOut = sumBy(periodBank.filter((b) => b.status !== "ignored" && b.amount < 0), (b) => -b.amount);

  const owedToYou = sumBy(openInvoices, (i) => i.outstanding);
  const overdueToYou = sumBy(
    openInvoices.filter((i) => daysBetween(dueDateFor(i.dueDate, i.issueDate), today) > 0),
    (i) => i.outstanding
  );
  const unpaidBills = recentPurchases.filter((p) => p.paidOn === null);
  const youOwe = sumBy(unpaidBills, (p) => p.gross);
  const overdueYouOwe = sumBy(
    unpaidBills.filter((p) => daysBetween(dueDateFor(p.dueDate, p.purchaseDate), today) > 0),
    (p) => p.gross
  );

  const opsExceptions = buildOpsExceptions({
    today,
    payRuns: payRunsAll.data ?? [],
    cashUps: cashUps.data ?? [],
    wastage: wastage.data ?? [],
    connections: connections.data ?? [],
    cardTakings: sumBy(posRecent.data ?? [], (p) => p.card_total),
    processorDeposits: sumBy((recentBank.data ?? []).filter((b) => isProcessorDeposit(b.description)), (b) => b.amount),
  });
  const exceptions = [
    ...opsExceptions,
    ...buildExceptions({
      today,
      invoices: openInvoices.map((i) => ({
        id: i.id,
        number: i.number,
        customerName: i.customerName,
        status: i.status,
        issueDate: i.issueDate,
        dueDate: i.dueDate,
        total: i.total,
        paid: i.paid,
      })),
      purchases: recentPurchases,
      purchaseLines,
      invoiceLines: recentLines,
      unreviewedBank: { count: unreviewed.count ?? 0, oldestDate: unreviewed.data?.[0]?.txn_date ?? null },
    }),
  ];

  return {
    sales,
    salesIncludesPos: posPeriod.length > 0,
    purchases,
    expenses,
    staff,
    profit,
    moneyIn,
    moneyOut,
    owedToYou,
    overdueToYou,
    youOwe,
    overdueYouOwe,
    exceptions,
  };
}
