import { addDays, daysBetween } from "./ageing";
import { payeeKey } from "./bank-csv";
import { toIsoDate } from "./period";
import { splitGross, syncInvoiceStatus, type BookkeepingCtx } from "./server-actions";

/** Deliberately conservative: this is money-matching, so it only acts when there's no ambiguity.
 * Two signals are required together — an exact amount AND the counterparty's own name or
 * reference appearing in the bank line — because an exact amount alone is a coincidence that
 * happens often (round numbers, repeat invoice values). Never matches more than one candidate. */

const STOPWORDS = new Set(["the", "of", "and", "ltd", "limited", "llp", "plc", "uk", "co", "company", "inc", "group"]);

function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/** Whether the bank line's own text plausibly names this counterparty — a token of their name,
 * or a reference number they gave us, appears in the description. Both sides are normalised the
 * same way (letters/digits only) so punctuation differences — "BRK-55" vs "BRK 55" — don't hide
 * a genuine reference match. */
function mentionsParty(description: string, name: string, reference?: string | null): boolean {
  const desc = description.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const words = new Set(desc.split(/\s+/));
  if (reference) {
    const cleanRef = reference.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
    if (cleanRef.length >= 3 && desc.includes(cleanRef)) return true;
  }
  return nameTokens(name).some((t) => words.has(t));
}

export type OpenInvoiceLite = { id: string; number: string | null; customerName: string; outstanding: number; total: number };
export type UnpaidBillLite = { id: string; vendorName: string; supplierRef: string | null; gross: number };

/** Open invoices and unpaid bills, loaded straight from whichever client the caller has —
 * request-scoped (manual import) or the admin client (the daily sync has no signed-in user).
 * Kept separate from the data.ts summaries, which are hardwired to the request-scoped client. */
export async function loadOpenInvoices(supabase: BookkeepingCtx["supabase"], orgId: string): Promise<OpenInvoiceLite[]> {
  const [{ data: invoices }, { data: payments }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, number, total, customers(name)")
      .eq("org_id", orgId)
      .in("status", ["sent", "overdue"]),
    supabase.from("invoice_payments").select("invoice_id, amount").eq("org_id", orgId),
  ]);
  const paidBy = new Map<string, number>();
  for (const p of payments ?? []) paidBy.set(p.invoice_id, (paidBy.get(p.invoice_id) ?? 0) + p.amount);

  return (
    (invoices as unknown as { id: string; number: string | null; total: number; customers: { name: string } | null }[] | null) ?? []
  )
    .map((i) => ({
      id: i.id,
      number: i.number,
      customerName: i.customers?.name ?? "—",
      total: i.total,
      outstanding: Math.max(0, Math.round((i.total - (paidBy.get(i.id) ?? 0)) * 100) / 100),
    }))
    .filter((i) => i.outstanding > 0);
}

export async function loadUnpaidBills(supabase: BookkeepingCtx["supabase"], orgId: string): Promise<UnpaidBillLite[]> {
  const { data } = await supabase
    .from("purchases")
    .select("id, supplier_ref, vendors(name), purchase_line_items(qty, unit_cost, line_total, vat_amount)")
    .eq("org_id", orgId)
    .is("paid_on", null);
  type Row = {
    id: string;
    supplier_ref: string | null;
    vendors: { name: string } | null;
    purchase_line_items: { qty: number; unit_cost: number; line_total: number | null; vat_amount: number | null }[];
  };
  return ((data as unknown as Row[] | null) ?? []).map((p) => {
    const net = p.purchase_line_items.reduce((s, l) => s + (l.line_total ?? l.qty * l.unit_cost), 0);
    const vat = p.purchase_line_items.reduce((s, l) => s + (l.vat_amount ?? 0), 0);
    return { id: p.id, vendorName: p.vendors?.name ?? "—", supplierRef: p.supplier_ref, gross: Math.round((net + vat) * 100) / 100 };
  });
}

export type AutoMatch = { kind: "invoice" | "purchase"; id: string };

/** A single unambiguous, name-confirmed candidate — or null if there's more than one match, or
 * none, or the amount matched but nothing in the text ties it to that specific counterparty. */
export function pickAutoMatch(amount: number, description: string, openInvoices: OpenInvoiceLite[], unpaidBills: UnpaidBillLite[]): AutoMatch | null {
  if (amount > 0) {
    const hits = openInvoices.filter(
      (i) => (Math.abs(i.outstanding - amount) < 0.005 || Math.abs(i.total - amount) < 0.005) && mentionsParty(description, i.customerName, i.number)
    );
    return hits.length === 1 ? { kind: "invoice", id: hits[0].id } : null;
  }
  const magnitude = Math.abs(amount);
  const hits = unpaidBills.filter((p) => Math.abs(p.gross - magnitude) < 0.005 && mentionsParty(description, p.vendorName, p.supplierRef));
  return hits.length === 1 ? { kind: "purchase", id: hits[0].id } : null;
}

/** For money movements that carry no counterparty name to check — cash bankings, payroll
 * transfers — confidence instead comes from the amount being unique among every candidate that's
 * still waiting to be matched (not just the ones inside the date window) and the bank line
 * falling in a plausible window around the candidate's own date. A round-number cash-up banked
 * three weeks from now sharing today's deposit amount is exactly the coincidence this guards
 * against: the window alone would miss it, since only the uniqueness check sees it. */
function pickWindowed<T extends { amount: number; date: string }>(
  txnDate: string,
  amount: number,
  candidates: T[],
  window: { beforeDays: number; afterDays: number }
): T | null {
  const sameAmount = candidates.filter((c) => Math.abs(c.amount - amount) < 0.005);
  if (sameAmount.length !== 1) return null;
  const only = sameAmount[0];
  const offset = daysBetween(only.date, txnDate); // > 0 once txnDate is after the candidate's own date
  if (offset < -window.beforeDays || offset > window.afterDays) return null;
  return only;
}

export type CashUpLite = { id: string; till: string; cashupDate: string; banked: number };

/** Cash-ups whose banked cash hasn't been linked to a bank line yet, from the last 4 months
 * (older stragglers are left for a person to chase down rather than risk a stale coincidence). */
export async function loadUnbankedCashUps(supabase: BookkeepingCtx["supabase"], orgId: string, today: string): Promise<CashUpLite[]> {
  const { data } = await supabase
    .from("cash_ups")
    .select("id, till, cashup_date, cash_banked")
    .eq("org_id", orgId)
    .is("banked_bank_transaction_id", null)
    .gte("cashup_date", addDays(today, -120))
    .gt("cash_banked", 0);
  return (data ?? []).map((c) => ({ id: c.id, till: c.till, cashupDate: c.cashup_date, banked: c.cash_banked ?? 0 }));
}

/** A deposit is matched to the till's banked cash on amount + a roughly week-long banking-lag
 * window — cash rarely reaches the bank same day, but shouldn't sit unbanked for long either. */
export function pickCashUpMatch(amount: number, txnDate: string, cashUps: CashUpLite[]): CashUpLite | null {
  if (amount <= 0) return null;
  return pickWindowed(txnDate, amount, cashUps.map((c) => ({ ...c, amount: c.banked, date: c.cashupDate })), { beforeDays: 0, afterDays: 7 });
}

export type PayRunLite = {
  id: string;
  payDate: string;
  netPay: number;
  netPayMatched: boolean;
  hmrcDueDate: string;
  hmrcLiability: number;
  hmrcMatched: boolean;
};

export async function loadPendingPayRuns(supabase: BookkeepingCtx["supabase"], orgId: string, today: string): Promise<PayRunLite[]> {
  const { data } = await supabase
    .from("pay_runs")
    .select("id, pay_date, net_pay, net_pay_bank_transaction_id, hmrc_due_date, hmrc_liability, hmrc_paid_on")
    .eq("org_id", orgId)
    .gte("pay_date", addDays(today, -120))
    .or("net_pay_bank_transaction_id.is.null,hmrc_paid_on.is.null");
  return (data ?? []).map((r) => ({
    id: r.id,
    payDate: r.pay_date,
    netPay: r.net_pay ?? 0,
    netPayMatched: r.net_pay_bank_transaction_id !== null,
    hmrcDueDate: r.hmrc_due_date,
    hmrcLiability: r.hmrc_liability ?? 0,
    hmrcMatched: r.hmrc_paid_on !== null,
  }));
}

/** The lump-sum BACS transfer covering a pay run's net wages — matched on amount and a few days'
 * grace either side of pay day, since payroll bureaus often debit a day or two early. */
export function pickPayrollNetMatch(amount: number, txnDate: string, payRuns: PayRunLite[]): PayRunLite | null {
  if (amount >= 0) return null;
  const pending = payRuns.filter((r) => !r.netPayMatched && r.netPay > 0).map((r) => ({ ...r, amount: -r.netPay, date: r.payDate }));
  return pickWindowed(txnDate, amount, pending, { beforeDays: 3, afterDays: 3 });
}

const HMRC_WORDS = ["hmrc", "hm revenue", "paye", "vat "];

/** The PAYE/NI payment to HMRC — amount plus either a wider date window around the due date, or
 * (when the amount alone is unambiguous) the bank line actually saying HMRC/PAYE. */
export function pickPayrollHmrcMatch(amount: number, description: string, txnDate: string, payRuns: PayRunLite[]): PayRunLite | null {
  if (amount >= 0) return null;
  const pending = payRuns.filter((r) => !r.hmrcMatched && r.hmrcLiability > 0).map((r) => ({ ...r, amount: -r.hmrcLiability, date: r.hmrcDueDate }));
  const desc = description.toLowerCase();
  const looksLikeHmrc = HMRC_WORDS.some((w) => desc.includes(w));
  return pickWindowed(txnDate, amount, pending, looksLikeHmrc ? { beforeDays: 20, afterDays: 10 } : { beforeDays: 10, afterDays: 5 });
}

export type PayeeHistoryEntry = { category: string; vatRate: number; count: number; consistent: boolean };

/** How a payee has been categorised in the past: their most-used category and VAT rate, and
 * whether every one of their last few expenses agreed (as opposed to one being an outlier). */
export async function buildPayeeHistory(supabase: BookkeepingCtx["supabase"], orgId: string): Promise<Map<string, PayeeHistoryEntry>> {
  const { data: txns } = await supabase
    .from("bank_transactions")
    .select("description, matched_id")
    .eq("org_id", orgId)
    .eq("matched_type", "expense")
    .order("txn_date", { ascending: false })
    .limit(500);
  const ids = (txns ?? []).map((t) => t.matched_id).filter((id): id is string => !!id);
  if (!ids.length) return new Map();

  const { data: expenses } = await supabase.from("expenses").select("id, category, vat_amount, net_amount").in("id", ids);
  const byId = new Map((expenses ?? []).map((e) => [e.id, e]));

  const byPayee = new Map<string, { category: string; vatRate: number }[]>();
  for (const t of txns ?? []) {
    const exp = t.matched_id ? byId.get(t.matched_id) : undefined;
    if (!exp) continue;
    const key = payeeKey(t.description);
    if (!key) continue;
    const vatRate = exp.net_amount > 0 ? Math.round((exp.vat_amount / exp.net_amount) * 100) : 0;
    const list = byPayee.get(key) ?? [];
    list.push({ category: exp.category, vatRate: [0, 5, 20].includes(vatRate) ? vatRate : 0 });
    byPayee.set(key, list);
  }

  const out = new Map<string, PayeeHistoryEntry>();
  for (const [key, list] of byPayee) {
    const [most] = list;
    const consistent = list.every((e) => e.category === most.category && e.vatRate === most.vatRate);
    out.set(key, { category: most.category, vatRate: most.vatRate, count: list.length, consistent });
  }
  return out;
}

/** Only auto-categorise once a payee has a real track record — at least 3 expenses, every one of
 * them coded the same way. A single prior expense (or a mixed history) is left for the person. */
export function pickAutoCategory(description: string, history: Map<string, PayeeHistoryEntry>): { category: string; vatRate: number } | null {
  const entry = history.get(payeeKey(description));
  if (!entry || entry.count < 3 || !entry.consistent) return null;
  return { category: entry.category, vatRate: entry.vatRate };
}

export type AutoProcessResult = { matched: number; categorised: number; banked: number; payroll: number };

/** Applies pickAutoMatch / pickAutoCategory to a freshly-imported batch of unreviewed lines.
 * Works from either a request-scoped client (manual CSV import) or the admin client (the daily
 * sync, which has no signed-in user) — it only needs an org id and open invoices/bills already
 * loaded, so the caller controls exactly what "open" means at that moment. */
export async function autoProcessBankTransactions(
  supabase: BookkeepingCtx["supabase"],
  orgId: string,
  txnIds: string[],
  openInvoices: OpenInvoiceLite[],
  unpaidBills: UnpaidBillLite[]
): Promise<AutoProcessResult> {
  const zero = { matched: 0, categorised: 0, banked: 0, payroll: 0 };
  if (!txnIds.length) return zero;
  const { data: txns } = await supabase
    .from("bank_transactions")
    .select("id, txn_date, description, amount, status")
    .eq("org_id", orgId)
    .eq("status", "unreviewed")
    .in("id", txnIds);
  if (!txns?.length) return zero;

  const today = toIsoDate(new Date());
  const [history, cashUpPool, payRunPool] = await Promise.all([
    buildPayeeHistory(supabase, orgId),
    loadUnbankedCashUps(supabase, orgId, today),
    loadPendingPayRuns(supabase, orgId, today),
  ]);
  // Once a candidate is used, it's removed from the pool so two lines in the same batch can't
  // both claim the same invoice, bill, cash-up or pay run (e.g. an accidental double statement line).
  const invoicePool = [...openInvoices];
  const billPool = [...unpaidBills];

  let matched = 0;
  let categorised = 0;
  let banked = 0;
  let payroll = 0;

  for (const t of txns) {
    const pick = pickAutoMatch(t.amount, t.description, invoicePool, billPool);
    if (pick?.kind === "invoice") {
      const { error } = await supabase.from("invoice_payments").insert({
        org_id: orgId,
        invoice_id: pick.id,
        amount: t.amount,
        paid_on: t.txn_date,
        method: "bank",
        bank_transaction_id: t.id,
      });
      if (!error) {
        await supabase.from("bank_transactions").update({ status: "matched", matched_type: "invoice", matched_id: pick.id, note: "Auto-matched" }).eq("id", t.id);
        await syncInvoiceStatus(supabase, orgId, pick.id);
        const idx = invoicePool.findIndex((i) => i.id === pick.id);
        if (idx !== -1) invoicePool.splice(idx, 1);
        matched++;
      }
      continue;
    }
    if (pick?.kind === "purchase") {
      const { error } = await supabase.from("purchases").update({ paid_on: t.txn_date }).eq("id", pick.id).eq("org_id", orgId);
      if (!error) {
        await supabase.from("bank_transactions").update({ status: "matched", matched_type: "purchase", matched_id: pick.id, note: "Auto-matched" }).eq("id", t.id);
        const idx = billPool.findIndex((p) => p.id === pick.id);
        if (idx !== -1) billPool.splice(idx, 1);
        matched++;
      }
      continue;
    }

    if (t.amount > 0) {
      const cashUp = pickCashUpMatch(t.amount, t.txn_date, cashUpPool);
      if (cashUp) {
        const { error } = await supabase.from("cash_ups").update({ banked_bank_transaction_id: t.id }).eq("id", cashUp.id).eq("org_id", orgId);
        if (!error) {
          await supabase.from("bank_transactions").update({ status: "matched", matched_type: "cashup", matched_id: cashUp.id, note: "Auto-matched" }).eq("id", t.id);
          const idx = cashUpPool.findIndex((c) => c.id === cashUp.id);
          if (idx !== -1) cashUpPool.splice(idx, 1);
          banked++;
        }
      }
      continue;
    }

    const netPayRun = pickPayrollNetMatch(t.amount, t.txn_date, payRunPool);
    if (netPayRun) {
      const { error } = await supabase.from("pay_runs").update({ net_pay_bank_transaction_id: t.id }).eq("id", netPayRun.id).eq("org_id", orgId);
      if (!error) {
        await supabase.from("bank_transactions").update({ status: "matched", matched_type: "payroll", matched_id: netPayRun.id, note: "Auto-matched: net pay" }).eq("id", t.id);
        const idx = payRunPool.findIndex((r) => r.id === netPayRun.id);
        if (idx !== -1) payRunPool[idx] = { ...payRunPool[idx], netPayMatched: true };
        payroll++;
      }
      continue;
    }
    const hmrcPayRun = pickPayrollHmrcMatch(t.amount, t.description, t.txn_date, payRunPool);
    if (hmrcPayRun) {
      const { error } = await supabase
        .from("pay_runs")
        .update({ hmrc_bank_transaction_id: t.id, hmrc_paid_on: t.txn_date })
        .eq("id", hmrcPayRun.id)
        .eq("org_id", orgId);
      if (!error) {
        await supabase.from("bank_transactions").update({ status: "matched", matched_type: "payroll", matched_id: hmrcPayRun.id, note: "Auto-matched: HMRC payment" }).eq("id", t.id);
        const idx = payRunPool.findIndex((r) => r.id === hmrcPayRun.id);
        if (idx !== -1) payRunPool[idx] = { ...payRunPool[idx], hmrcMatched: true };
        payroll++;
      }
      continue;
    }

    const category = pickAutoCategory(t.description, history);
    if (category) {
      const { net, vat } = splitGross(Math.abs(t.amount), category.vatRate);
      const { data: expense, error } = await supabase
        .from("expenses")
        .insert({
          org_id: orgId,
          expense_date: t.txn_date,
          payee: t.description.slice(0, 120),
          category: category.category,
          net_amount: net,
          vat_amount: vat,
          payment_method: "bank",
          bank_transaction_id: t.id,
        })
        .select("id")
        .single();
      if (!error && expense) {
        await supabase.from("bank_transactions").update({ status: "matched", matched_type: "expense", matched_id: expense.id, note: "Auto-categorised" }).eq("id", t.id);
        categorised++;
      }
    }
  }

  return { matched, categorised, banked, payroll };
}
