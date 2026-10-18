import { formatGBP, roundMoney } from "@/lib/format";
import { addDays, daysBetween, dueDateFor } from "./ageing";

export type Severity = "high" | "medium" | "info";
export type BookkeepingException = {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  href?: string;
};

export type ExceptionInvoice = {
  id: string;
  number: string | null;
  customerName: string;
  status: string;
  issueDate: string;
  dueDate: string | null;
  total: number;
  paid: number;
};

export type ExceptionPurchase = {
  id: string;
  vendorId: string;
  vendorName: string;
  purchaseDate: string;
  dueDate: string | null;
  paidOn: string | null;
  net: number;
  gross: number;
  supplierRef: string | null;
};

export type ExceptionPurchaseLine = {
  vendorId: string;
  vendorName: string;
  itemId: string | null;
  description: string;
  purchaseDate: string;
  unitCost: number;
  vatRate: number;
};

export type ExceptionInvoiceLine = {
  invoiceId: string;
  invoiceNumber: string | null;
  customerName: string;
  issueDate: string;
  description: string;
  qty: number;
  unitCost: number;
  unitPrice: number;
};

export type ExceptionInput = {
  today: string;
  invoices: ExceptionInvoice[];
  purchases: ExceptionPurchase[];
  purchaseLines: ExceptionPurchaseLine[];
  invoiceLines: ExceptionInvoiceLine[];
  unreviewedBank: { count: number; oldestDate: string | null };
};

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, info: 2 };

/** Monday of the week containing `date` (yyyy-mm-dd). */
function weekStart(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // Mon=0
  return addDays(date, -dow);
}

function capped<T>(items: T[], max: number): { shown: T[]; extra: number } {
  return { shown: items.slice(0, max), extra: Math.max(0, items.length - max) };
}

export function buildExceptions(input: ExceptionInput): BookkeepingException[] {
  const { today } = input;
  const out: BookkeepingException[] = [];

  // 1. Overdue customer invoices.
  const overdueInvoices = input.invoices
    .filter((inv) => (inv.status === "sent" || inv.status === "overdue") && inv.total - inv.paid > 0.005)
    .map((inv) => {
      const due = dueDateFor(inv.dueDate, inv.issueDate);
      return { inv, due, days: daysBetween(due, today) };
    })
    .filter((x) => x.days > 0)
    .sort((a, b) => b.days - a.days);
  const inv = capped(overdueInvoices, 8);
  for (const { inv: i, due, days } of inv.shown) {
    out.push({
      id: `inv-overdue-${i.id}`,
      severity: days > 30 ? "high" : "medium",
      title: `Invoice ${i.number ?? i.id.slice(0, 8)} is ${days} day${days === 1 ? "" : "s"} overdue`,
      detail: `${i.customerName} owes ${formatGBP(roundMoney(i.total - i.paid))} (was due ${due}).`,
      href: "/dashboard/bookkeeping/receivables",
    });
  }
  if (inv.extra) {
    out.push({
      id: "inv-overdue-more",
      severity: "info",
      title: `${inv.extra} more overdue invoice${inv.extra === 1 ? "" : "s"}`,
      detail: "See Receivables for the full list.",
      href: "/dashboard/bookkeeping/receivables",
    });
  }

  // 2. Overdue supplier bills.
  const overdueBills = input.purchases
    .filter((p) => p.paidOn === null && p.gross > 0.005)
    .map((p) => {
      const due = dueDateFor(p.dueDate, p.purchaseDate);
      return { p, due, days: daysBetween(due, today) };
    })
    .filter((x) => x.days > 0)
    .sort((a, b) => b.days - a.days);
  const bills = capped(overdueBills, 8);
  for (const { p, due, days } of bills.shown) {
    out.push({
      id: `bill-overdue-${p.id}`,
      severity: days > 30 ? "high" : "medium",
      title: `Bill from ${p.vendorName} is ${days} day${days === 1 ? "" : "s"} overdue`,
      detail: `${formatGBP(p.gross)}${p.supplierRef ? ` (ref ${p.supplierRef})` : ""} was due ${due} and isn't marked paid.`,
      href: "/dashboard/bookkeeping/payables",
    });
  }
  if (bills.extra) {
    out.push({
      id: "bill-overdue-more",
      severity: "info",
      title: `${bills.extra} more unpaid bill${bills.extra === 1 ? "" : "s"} past due`,
      detail: "See Payables for the full list.",
      href: "/dashboard/bookkeeping/payables",
    });
  }

  // 3. Possible duplicate supplier bills: same supplier, same amount, within a week.
  const byVendorAmount = new Map<string, ExceptionPurchase[]>();
  for (const p of input.purchases) {
    if (p.gross <= 0.005) continue;
    const key = `${p.vendorId}|${p.gross.toFixed(2)}`;
    byVendorAmount.set(key, [...(byVendorAmount.get(key) ?? []), p]);
  }
  const dupes: ExceptionPurchase[][] = [];
  for (const group of byVendorAmount.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate));
    for (let i = 1; i < sorted.length; i++) {
      if (Math.abs(daysBetween(sorted[i - 1].purchaseDate, sorted[i].purchaseDate)) <= 7) {
        dupes.push([sorted[i - 1], sorted[i]]);
      }
    }
  }
  const dupeCap = capped(dupes, 6);
  for (const [a, b] of dupeCap.shown) {
    out.push({
      id: `dupe-${a.id}-${b.id}`,
      severity: "medium",
      title: `Possible duplicate bill from ${a.vendorName}`,
      detail: `${formatGBP(a.gross)} on ${a.purchaseDate} and again on ${b.purchaseDate}.`,
      href: "/dashboard/bookkeeping/payables",
    });
  }
  if (dupeCap.extra) {
    out.push({
      id: "dupe-more",
      severity: "info",
      title: `${dupeCap.extra} more possible duplicate bills`,
      detail: "Check Payables for repeated supplier + amount pairs.",
      href: "/dashboard/bookkeeping/payables",
    });
  }

  // 4. Weekly purchases up sharply on the previous four weeks (last complete week).
  const weekly = new Map<string, number>();
  for (const p of input.purchases) {
    const w = weekStart(p.purchaseDate);
    weekly.set(w, roundMoney((weekly.get(w) ?? 0) + p.net));
  }
  const lastWeek = addDays(weekStart(today), -7);
  const prior = [1, 2, 3, 4].map((n) => weekly.get(addDays(lastWeek, -7 * n)) ?? 0);
  const priorNonZero = prior.filter((v) => v > 0);
  if (priorNonZero.length >= 2) {
    const avg = roundMoney(prior.reduce((s, v) => s + v, 0) / 4);
    const last = weekly.get(lastWeek) ?? 0;
    if (avg > 0 && last > avg * 1.2 && last - avg > 50) {
      const pct = Math.round(((last - avg) / avg) * 100);
      out.push({
        id: "cost-spike",
        severity: last > avg * 1.5 ? "high" : "medium",
        title: `Purchases up ${pct}% last week`,
        detail: `${formatGBP(last)} bought in the week of ${lastWeek}, against a ${formatGBP(avg)} average for the previous four weeks.`,
        href: "/dashboard/bookkeeping/pnl",
      });
    }
  }

  // 5. Items sold below what they cost.
  const belowCost = new Map<string, { count: number; loss: number; example: ExceptionInvoiceLine }>();
  for (const l of input.invoiceLines) {
    if (l.unitCost > 0 && l.unitPrice < l.unitCost) {
      const cur = belowCost.get(l.description) ?? { count: 0, loss: 0, example: l };
      cur.count += 1;
      cur.loss = roundMoney(cur.loss + (l.unitCost - l.unitPrice) * l.qty);
      belowCost.set(l.description, cur);
    }
  }
  const below = capped([...belowCost.entries()].sort((a, b) => b[1].loss - a[1].loss), 6);
  for (const [description, v] of below.shown) {
    out.push({
      id: `below-cost-${description}`,
      severity: "medium",
      title: `${description} sold below cost`,
      detail: `${v.count} invoice line${v.count === 1 ? "" : "s"} priced under cost, losing ${formatGBP(v.loss)} (latest: ${v.example.customerName}, invoice ${v.example.invoiceNumber ?? v.example.invoiceId.slice(0, 8)}).`,
      href: `/dashboard/invoices/${v.example.invoiceId}`,
    });
  }

  // 6. Supplier price jumps and VAT-rate changes versus the previous bill for the same item.
  const lineGroups = new Map<string, ExceptionPurchaseLine[]>();
  for (const l of input.purchaseLines) {
    if (!l.itemId) continue;
    const key = `${l.vendorId}|${l.itemId}`;
    lineGroups.set(key, [...(lineGroups.get(key) ?? []), l]);
  }
  const recentCutoff = addDays(today, -60);
  const priceJumps: BookkeepingException[] = [];
  const vatChanges: BookkeepingException[] = [];
  for (const [key, lines] of lineGroups) {
    const sorted = [...lines].sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (cur.purchaseDate < recentCutoff) continue;
      if (prev.unitCost > 0 && (cur.unitCost - prev.unitCost) / prev.unitCost > 0.15) {
        const pct = Math.round(((cur.unitCost - prev.unitCost) / prev.unitCost) * 100);
        priceJumps.push({
          id: `price-${key}-${cur.purchaseDate}`,
          severity: "medium",
          title: `${cur.description} up ${pct}% from ${cur.vendorName}`,
          detail: `${formatGBP(prev.unitCost)} on ${prev.purchaseDate} → ${formatGBP(cur.unitCost)} on ${cur.purchaseDate}.`,
        });
      }
      if (cur.vatRate !== prev.vatRate) {
        vatChanges.push({
          id: `vat-${key}-${cur.purchaseDate}`,
          severity: "info",
          title: `VAT rate changed on ${cur.description} from ${cur.vendorName}`,
          detail: `${prev.vatRate}% on ${prev.purchaseDate} → ${cur.vatRate}% on ${cur.purchaseDate}. Check the treatment is right.`,
          href: "/dashboard/bookkeeping/vat",
        });
      }
    }
  }
  out.push(...priceJumps.slice(0, 6), ...vatChanges.slice(0, 4));

  // 7. Bank lines waiting for review.
  if (input.unreviewedBank.count > 0) {
    const stale = input.unreviewedBank.oldestDate && daysBetween(input.unreviewedBank.oldestDate, today) > 14;
    out.push({
      id: "bank-unreviewed",
      severity: stale ? "medium" : "info",
      title: `${input.unreviewedBank.count} bank transaction${input.unreviewedBank.count === 1 ? "" : "s"} to review`,
      detail: stale
        ? `The oldest is from ${input.unreviewedBank.oldestDate}. Match, categorise or ignore each one.`
        : "Match each to an invoice, bill or expense, or ignore transfers.",
      href: "/dashboard/bookkeeping/bank",
    });
  }

  return out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
