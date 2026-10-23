import { roundMoney } from "@/lib/format";
import type { StatementExtraction } from "./extract";

export type StatementRow = {
  date: string;
  description: string;
  /** Money in is positive, money out is negative. */
  amount: number;
  /** The balance printed on the row (or worked out), when known. */
  balance: number | null;
  /** True when something about this row should be double-checked. */
  check: boolean;
  problem: string | null;
};

export type StatementCheck = { ok: boolean; text: string };

export type ReconciledStatement = {
  rows: StatementRow[];
  accountLabel: string;
  openingBalance: number | null;
  closingBalance: number | null;
  totalIn: number;
  totalOut: number;
  checks: StatementCheck[];
  /** Every check passed and no row is flagged — safe to import without a look. */
  allGood: boolean;
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number) => String(n).padStart(2, "0");
const near = (a: number, b: number, tol = 0.011) => Math.abs(a - b) <= tol;

/** Turns "03 AUG" / "02 SEP 2026" into yyyy-mm-dd, taking the year from the statement period when
 * the row doesn't print one (and handling a December → January statement). */
export function resolveStatementDate(printed: string, from: string | null, to: string | null): string | null {
  const m = printed.trim().toLowerCase().match(/^(\d{1,2})\s*[-/ ]?\s*([a-z]{3,})\.?(?:\s*[-/ ]?\s*(\d{4}))?$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = MONTHS.indexOf(m[2].slice(0, 3)) + 1;
  if (!month || day < 1 || day > 31) return null;
  if (m[3]) return `${m[3]}-${pad(month)}-${pad(day)}`;
  const years = [...new Set([from, to].filter((d): d is string => !!d).map((d) => Number(d.slice(0, 4))))];
  if (!years.length) return null;
  const fit = years.find((y) => {
    const iso = `${y}-${pad(month)}-${pad(day)}`;
    return (!from || iso >= from) && (!to || iso <= to);
  });
  return `${fit ?? years[years.length - 1]}-${pad(month)}-${pad(day)}`;
}

/** Checks a scanned statement page against its own numbers. The amount's direction is taken from the
 * running balance whenever one is printed (more reliable than which column a figure sat in), and
 * every row, the summary box and the opening/closing balances must agree before it's called good. */
export function reconcileStatement(ex: StatementExtraction): ReconciledStatement {
  const checks: StatementCheck[] = [];
  const rows: StatementRow[] = [];
  let prevDate: string | null = ex.periodFrom;
  let prevBalance: number | null = ex.openingBalance;
  let anyProblem = false;

  for (const raw of ex.rows) {
    const date = (raw.datePrinted ? resolveStatementDate(raw.datePrinted, ex.periodFrom, ex.periodTo) : null) ?? prevDate;
    if (!date) continue;
    prevDate = date;

    const stated = raw.paidIn !== null && raw.paidIn > 0 ? raw.paidIn : raw.withdrawn !== null && raw.withdrawn > 0 ? -raw.withdrawn : null;
    let amount = stated;
    let problem: string | null = null;

    if (raw.balance !== null && prevBalance !== null) {
      const delta = roundMoney(raw.balance - prevBalance);
      if (stated === null) {
        amount = delta;
        problem = "No amount was read for this row — worked out from the balance.";
      } else if (near(delta, stated)) {
        amount = stated;
      } else if (near(delta, -stated)) {
        amount = delta; // read the wrong column — the balance says which way the money moved
        problem = "The money in / out columns looked swapped — corrected from the balance.";
      } else {
        problem = `The balance moved by ${delta >= 0 ? "+" : "−"}£${Math.abs(delta).toFixed(2)} but the amount read was ${stated >= 0 ? "+" : "−"}£${Math.abs(stated).toFixed(2)} — a row may be missing or misread.`;
      }
    } else if (stated === null) {
      continue;
    }
    if (amount === null || amount === 0) continue;

    const balance = raw.balance ?? (prevBalance !== null ? roundMoney(prevBalance + amount) : null);
    if (problem) anyProblem = true;
    rows.push({ date, description: raw.description, amount: roundMoney(amount), balance, check: !!problem, problem });
    prevBalance = balance;
  }

  const totalIn = roundMoney(rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0));
  const totalOut = roundMoney(rows.filter((r) => r.amount < 0).reduce((s, r) => s - r.amount, 0));

  if (ex.openingBalance !== null && ex.closingBalance !== null) {
    const expected = roundMoney(ex.openingBalance + totalIn - totalOut);
    checks.push(
      near(expected, ex.closingBalance)
        ? { ok: true, text: `Opening balance £${ex.openingBalance.toFixed(2)} + £${totalIn.toFixed(2)} in − £${totalOut.toFixed(2)} out = £${ex.closingBalance.toFixed(2)}, matching the statement's closing balance.` }
        : { ok: false, text: `Opening £${ex.openingBalance.toFixed(2)} + £${totalIn.toFixed(2)} in − £${totalOut.toFixed(2)} out = £${expected.toFixed(2)}, but the statement's closing balance is £${ex.closingBalance.toFixed(2)} — a row may be missing or misread.` }
    );
  } else {
    checks.push({ ok: false, text: "The opening or closing balance couldn't be read, so the page couldn't be fully checked." });
  }
  if (ex.totalPaidIn !== null) {
    checks.push(
      near(totalIn, ex.totalPaidIn)
        ? { ok: true, text: `Money in matches the statement's "Paid In" total of £${ex.totalPaidIn.toFixed(2)}.` }
        : { ok: false, text: `The rows add up to £${totalIn.toFixed(2)} in but the statement says £${ex.totalPaidIn.toFixed(2)}${ex.totalPages && ex.totalPages > 1 ? " — the rest may be on another page" : ""}.` }
    );
  }
  if (ex.totalWithdrawn !== null) {
    checks.push(
      near(totalOut, ex.totalWithdrawn)
        ? { ok: true, text: `Money out matches the statement's "Withdrawn" total of £${ex.totalWithdrawn.toFixed(2)}.` }
        : { ok: false, text: `The rows add up to £${totalOut.toFixed(2)} out but the statement says £${ex.totalWithdrawn.toFixed(2)}${ex.totalPages && ex.totalPages > 1 ? " — the rest may be on another page" : ""}.` }
    );
  }
  if (!rows.length) checks.push({ ok: false, text: "No transactions could be read from this photo." });

  const label = [ex.accountLabel, ex.accountNumber ? `…${ex.accountNumber.slice(-4)}` : null].filter(Boolean).join(" ");
  return {
    rows,
    accountLabel: label,
    openingBalance: ex.openingBalance,
    closingBalance: ex.closingBalance,
    totalIn,
    totalOut,
    checks,
    allGood: rows.length > 0 && !anyProblem && checks.every((c) => c.ok),
  };
}
