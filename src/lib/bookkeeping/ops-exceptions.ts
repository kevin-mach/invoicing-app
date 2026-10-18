import { formatGBP, roundMoney } from "@/lib/format";
import { addDays, daysBetween } from "./ageing";
import { weekdayVariancePatterns } from "../cashup";
import type { BookkeepingException } from "./exceptions";

export type OpsInput = {
  today: string;
  payRuns: { id: string; pay_date: string; hmrc_due_date: string; hmrc_paid_on: string | null; hmrc_liability: number | null }[];
  cashUps: { cashup_date: string; variance: number | null }[];
  wastage: { logged_on: string; cost: number | null }[];
  connections: { provider: string; status: string; last_error: string | null; last_synced_at: string | null }[];
  cardTakings: number;
  processorDeposits: number;
};

const NAMES: Record<string, string> = { truelayer: "Bank feed", square: "Square", xero: "Xero", quickbooks: "QuickBooks", hmrc: "HMRC" };

/** Alerts for the newer modules: payroll tax deadlines, till shortfalls, wastage spikes, and
 * broken or stale connections. */
export function buildOpsExceptions(input: OpsInput): BookkeepingException[] {
  const out: BookkeepingException[] = [];
  const { today } = input;

  for (const r of input.payRuns) {
    if (r.hmrc_paid_on || !r.hmrc_liability) continue;
    const days = daysBetween(today, r.hmrc_due_date); // positive = days until due
    if (days < 0) {
      out.push({ id: `paye-over-${r.id}`, severity: "high", title: `PAYE/NI for ${r.pay_date} is overdue`, detail: `${formatGBP(r.hmrc_liability)} was due to HMRC on ${r.hmrc_due_date}. Late payment attracts interest and penalties.`, href: "/dashboard/bookkeeping/payroll" });
    } else if (days <= 7) {
      out.push({ id: `paye-soon-${r.id}`, severity: "medium", title: `PAYE/NI due in ${days} day${days === 1 ? "" : "s"}`, detail: `${formatGBP(r.hmrc_liability)} for the ${r.pay_date} pay run is due ${r.hmrc_due_date}.`, href: "/dashboard/bookkeeping/payroll" });
    }
  }

  for (const p of weekdayVariancePatterns(input.cashUps.map((c) => ({ cashup_date: c.cashup_date, variance: c.variance })))) {
    if (p.average < 0) {
      out.push({ id: `cash-${p.weekday}`, severity: "medium", title: `${p.weekday} tills are usually short`, detail: `Averaging ${formatGBP(Math.abs(p.average))} short across ${p.count} cash-ups (${formatGBP(Math.abs(p.total))} in total).`, href: "/dashboard/cash-up" });
    }
  }

  const since30 = addDays(today, -30);
  const since60 = addDays(today, -60);
  const recent = roundMoney(input.wastage.filter((w) => w.logged_on >= since30).reduce((s, w) => s + (w.cost ?? 0), 0));
  const prior = roundMoney(input.wastage.filter((w) => w.logged_on < since30 && w.logged_on >= since60).reduce((s, w) => s + (w.cost ?? 0), 0));
  if (prior >= 20 && recent > prior * 1.5 && recent - prior >= 20) {
    out.push({ id: "waste-spike", severity: "medium", title: "Wastage is up sharply", detail: `${formatGBP(recent)} in the last 30 days against ${formatGBP(prior)} the 30 days before.`, href: "/dashboard/stock?tab=wastage" });
  }

  if (input.cardTakings > 50) {
    const gap = roundMoney(input.cardTakings - input.processorDeposits);
    if (gap > 5 && gap / input.cardTakings > 0.05) {
      out.push({ id: "card-settle", severity: "medium", title: "Card takings not fully in the bank", detail: `POS card takings ${formatGBP(input.cardTakings)} vs ${formatGBP(input.processorDeposits)} of processor deposits. Check for missing payouts or unimported bank lines.`, href: "/dashboard/bookkeeping/pos" });
    }
  }

  for (const c of input.connections) {
    const name = NAMES[c.provider] ?? c.provider;
    if (c.status === "error") {
      out.push({ id: `conn-${c.provider}`, severity: "high", title: `${name} connection needs attention`, detail: c.last_error ?? "The connection failed. Reconnect to resume.", href: "/dashboard/bookkeeping/connections" });
    } else if (c.status === "connected" && (c.provider === "truelayer" || c.provider === "square") && c.last_synced_at && daysBetween(c.last_synced_at.slice(0, 10), today) > 3) {
      out.push({ id: `stale-${c.provider}`, severity: "medium", title: `${name} hasn't synced for over 3 days`, detail: "Data may be out of date. Try Sync now on the Connections tab.", href: "/dashboard/bookkeeping/connections" });
    }
  }
  return out;
}
