"use client";

import { useState } from "react";
import { DateInput } from "@/components/date-input";
import {
  detectPayrollColumns,
  hmrcDueDate,
  hmrcLiability,
  parsePayrollRows,
  PAYROLL_FIELDS,
  type PayrollColumns,
  type PayRunInput,
} from "@/lib/bookkeeping/payroll";
import { formatGBP } from "@/lib/format";
import { btnPrimary, FormNote, inputClass, labelClass, rowBtnSecondary, type FormStatus } from "@/components/bookkeeping/ui";
import { CsvImportPanel } from "@/components/bookkeeping/csv-import";
import { addPayRun, deletePayRun, importPayRuns, setPayRunHmrcPaid } from "../payroll-actions";

const NUM_FIELDS = [
  ["gross_pay", "Gross pay"],
  ["employer_ni", "Employer NI"],
  ["employer_pension", "Employer pension"],
  ["employee_ni", "Employee NI"],
  ["employee_pension", "Employee pension"],
  ["paye", "PAYE tax"],
  ["student_loan", "Student loan"],
  ["other_deductions", "Other deductions"],
] as const;

export function PayRunForm({ today }: { today: string }) {
  const [payDate, setPayDate] = useState(today);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [employees, setEmployees] = useState("");
  const [nums, setNums] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<FormStatus>(null);

  const n = (k: string) => Number(nums[k]) || 0;
  const liability = hmrcLiability({
    paye: n("paye"),
    employee_ni: n("employee_ni"),
    employer_ni: n("employer_ni"),
    student_loan: n("student_loan"),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const input: PayRunInput = {
      pay_date: payDate,
      period_start: start,
      period_end: end,
      employees: Number(employees) || 0,
      gross_pay: n("gross_pay"),
      employer_ni: n("employer_ni"),
      employer_pension: n("employer_pension"),
      employee_ni: n("employee_ni"),
      employee_pension: n("employee_pension"),
      paye: n("paye"),
      student_loan: n("student_loan"),
      other_deductions: n("other_deductions"),
    };
    const r = await addPayRun(input);
    setBusy(false);
    if (r.error) return setMessage({ ok: false, text: r.error });
    setMessage({ ok: true, text: "Pay run added." });
    setNums({});
    setEmployees("");
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="font-semibold text-slate-900 dark:text-slate-50">Add a pay run</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Copy the totals from your payroll software or payslip summary. This records payroll for your books — it doesn&apos;t
        calculate PAYE/NI or file with HMRC.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={labelClass}>Pay date</label>
          <DateInput required value={payDate} onChange={(e) => setPayDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Period start</label>
          <DateInput required value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Period end</label>
          <DateInput required value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Employees</label>
          <input type="number" min="0" value={employees} onChange={(e) => setEmployees(e.target.value)} className={`${inputClass} text-right`} />
        </div>
        {NUM_FIELDS.map(([k, label]) => (
          <div key={k}>
            <label className={labelClass}>{label}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required={k === "gross_pay"}
              value={nums[k] ?? ""}
              onChange={(e) => setNums((s) => ({ ...s, [k]: e.target.value }))}
              className={`${inputClass} text-right`}
            />
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
        HMRC liability {formatGBP(liability)} · due {hmrcDueDate(payDate)}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? "Saving..." : "Add pay run"}
        </button>
        <FormNote note={message} className="text-sm" />
      </div>
    </form>
  );
}

export function PayrollImport() {
  return (
    <CsvImportPanel<PayrollColumns, PayRunInput, Awaited<ReturnType<typeof importPayRuns>>>
      title="Import from payroll software"
      description="Upload a payroll summary export (Xero Payroll, BrightPay, Staffology, QuickBooks Payroll…) — one row per pay run."
      fields={PAYROLL_FIELDS}
      detectColumns={detectPayrollColumns}
      parse={(rows, cols) => {
        const r = parsePayrollRows(rows, cols);
        return { items: r.runs, skipped: r.skipped };
      }}
      onImport={importPayRuns}
      renderSummary={(parsed) => (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {parsed.items.length} pay run{parsed.items.length === 1 ? "" : "s"} found
          {parsed.skipped ? `, ${parsed.skipped} row(s) skipped (no pay date or gross pay)` : ""}. Total gross{" "}
          {formatGBP(parsed.items.reduce((s, r) => s + r.gross_pay, 0))}.
        </p>
      )}
      successText={(r) => `Imported ${r.inserted} pay run${r.inserted === 1 ? "" : "s"}${r.skipped ? `, skipped ${r.skipped} already on file or invalid` : ""}.`}
    />
  );
}

export function PayRunActions({ id, paidOn, today }: { id: string; paidOn: string | null; today: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<{ error: string | null }>) => {
    setBusy(true);
    setError(null);
    const r = await fn();
    setBusy(false);
    if (r.error) setError(r.error);
  };
  return (
    <span className="flex flex-wrap items-center justify-end gap-3">
      <button type="button" disabled={busy} onClick={() => run(() => setPayRunHmrcPaid(id, paidOn ? null : today))} className={rowBtnSecondary}>
        {paidOn ? "Mark unpaid" : "Mark HMRC paid"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => confirm("Delete this pay run?") && run(() => deletePayRun(id))}
        className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-60"
      >
        Delete
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}
