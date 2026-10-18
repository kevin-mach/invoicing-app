"use server";

import { hmrcDueDate, type PayRunInput } from "@/lib/bookkeeping/payroll";
import { bookkeepingCtx, ISO_DATE, NOT_ALLOWED, OK, refreshBookkeeping, type ActionResult } from "@/lib/bookkeeping/server-actions";
import { roundMoney } from "@/lib/format";

const PAY_FIELDS = ["gross_pay", "employer_ni", "employer_pension", "employee_ni", "employee_pension", "paye", "student_loan", "other_deductions"] as const;

function cleanPayRun(input: PayRunInput): PayRunInput | string {
  if (![input.pay_date, input.period_start, input.period_end].every((d) => ISO_DATE.test(d))) return "Enter valid dates.";
  if (input.period_end < input.period_start) return "The period can't end before it starts.";
  const out = { ...input, employees: Math.max(0, Math.round(Number(input.employees) || 0)) };
  for (const f of PAY_FIELDS) {
    const n = roundMoney(Number(input[f]));
    if (!Number.isFinite(n) || n < 0) return "Amounts can't be negative.";
    out[f] = n;
  }
  if (out.gross_pay <= 0) return "Enter the gross pay.";
  const deductions = out.employee_ni + out.employee_pension + out.paye + out.student_loan + out.other_deductions;
  if (deductions > out.gross_pay) return "Deductions are more than the gross pay — check the figures.";
  return out;
}

export async function addPayRun(input: PayRunInput): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  const clean = cleanPayRun(input);
  if (typeof clean === "string") return { error: clean };
  const { error } = await c.supabase.from("pay_runs").insert({ ...clean, org_id: c.org.orgId, hmrc_due_date: hmrcDueDate(clean.pay_date), source: "manual" });
  if (error) return { error: error.message };
  refreshBookkeeping();
  return OK;
}

export async function importPayRuns(runs: PayRunInput[]): Promise<ActionResult & { inserted?: number; skipped?: number }> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  if (!runs.length) return { error: "Nothing to import." };
  if (runs.length > 500) return { error: "Import at most 500 pay runs at a time." };

  const { data: existing } = await c.supabase.from("pay_runs").select("pay_date, gross_pay").eq("org_id", c.org.orgId);
  const seen = new Set((existing ?? []).map((e) => `${e.pay_date}|${e.gross_pay.toFixed(2)}`));

  const rows = [];
  let skipped = 0;
  for (const r of runs) {
    const clean = cleanPayRun(r);
    const key = typeof clean === "string" ? "" : `${clean.pay_date}|${clean.gross_pay.toFixed(2)}`;
    if (typeof clean === "string" || seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    rows.push({ ...clean, org_id: c.org.orgId, hmrc_due_date: hmrcDueDate(clean.pay_date), source: "csv" });
  }
  if (rows.length) {
    const { error } = await c.supabase.from("pay_runs").insert(rows);
    if (error) return { error: error.message };
  }
  refreshBookkeeping();
  return { error: null, inserted: rows.length, skipped };
}

export async function setPayRunHmrcPaid(id: string, paidOn: string | null): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  if (paidOn !== null && !ISO_DATE.test(paidOn)) return { error: "Enter a valid date." };

  if (paidOn === null) {
    // Un-marking as paid also releases whatever bank line was matched to it (if it was matched
    // automatically), so the line goes back to Unreviewed instead of pointing at a "paid" run
    // that no longer says it's paid.
    const { data: run } = await c.supabase.from("pay_runs").select("hmrc_bank_transaction_id").eq("id", id).eq("org_id", c.org.orgId).maybeSingle();
    if (run?.hmrc_bank_transaction_id) {
      await c.supabase
        .from("bank_transactions")
        .update({ status: "unreviewed", matched_type: null, matched_id: null, note: null })
        .eq("id", run.hmrc_bank_transaction_id)
        .eq("org_id", c.org.orgId);
    }
    const { error } = await c.supabase.from("pay_runs").update({ hmrc_paid_on: null, hmrc_bank_transaction_id: null }).eq("id", id).eq("org_id", c.org.orgId);
    if (error) return { error: error.message };
  } else {
    const { error } = await c.supabase.from("pay_runs").update({ hmrc_paid_on: paidOn }).eq("id", id).eq("org_id", c.org.orgId);
    if (error) return { error: error.message };
  }
  refreshBookkeeping();
  return OK;
}

export async function deletePayRun(id: string): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;

  const { data: run } = await c.supabase
    .from("pay_runs")
    .select("net_pay_bank_transaction_id, hmrc_bank_transaction_id")
    .eq("id", id)
    .eq("org_id", c.org.orgId)
    .maybeSingle();
  const linkedTxnIds = [run?.net_pay_bank_transaction_id, run?.hmrc_bank_transaction_id].filter((v): v is string => !!v);
  if (linkedTxnIds.length) {
    await c.supabase
      .from("bank_transactions")
      .update({ status: "unreviewed", matched_type: null, matched_id: null, note: null })
      .eq("org_id", c.org.orgId)
      .in("id", linkedTxnIds);
  }

  const { error } = await c.supabase.from("pay_runs").delete().eq("id", id).eq("org_id", c.org.orgId);
  if (error) return { error: error.message };
  refreshBookkeeping();
  return OK;
}
