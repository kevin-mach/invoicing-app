import { roundMoney } from "@/lib/format";
import { dateCell, detectColumns, numberCell } from "./csv-map";

export type PayRunInput = {
  period_start: string;
  period_end: string;
  pay_date: string;
  employees: number;
  gross_pay: number;
  employer_ni: number;
  employer_pension: number;
  employee_ni: number;
  employee_pension: number;
  paye: number;
  student_loan: number;
  other_deductions: number;
};

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** PAYE/NI is due to HMRC by the 22nd after the tax month ends (electronic payment). Tax months
 * run 6th to 5th, so a pay date on or before the 5th belongs to the tax month ending that 5th. */
export function hmrcDueDate(payDate: string): string {
  const [y, m, d] = payDate.split("-").map(Number);
  if (d <= 5) return iso(y, m, 22);
  return m === 12 ? iso(y + 1, 1, 22) : iso(y, m + 1, 22);
}

export function hmrcLiability(r: Pick<PayRunInput, "paye" | "employee_ni" | "employer_ni" | "student_loan">): number {
  return roundMoney(r.paye + r.employee_ni + r.employer_ni + r.student_loan);
}

export function totalStaffCost(r: Pick<PayRunInput, "gross_pay" | "employer_ni" | "employer_pension">): number {
  return roundMoney(r.gross_pay + r.employer_ni + r.employer_pension);
}

const ALIASES = {
  pay_date: ["paydate", "paymentdate", "date", "payday"],
  period_start: ["periodstart", "start", "from", "taxperiodstart"],
  period_end: ["periodend", "end", "to", "taxperiodend"],
  employees: ["employees", "headcount", "staff", "numberofemployees", "noofemployees"],
  gross_pay: ["gross", "grosspay", "totalgross", "grosswages", "grossearnings"],
  employer_ni: ["employerni", "employersni", "employernationalinsurance", "nier"],
  employer_pension: ["employerpension", "employerspension", "pensionemployer", "employerpensioncontribution"],
  employee_ni: ["employeeni", "employeesni", "ni", "nationalinsurance", "employeenationalinsurance"],
  employee_pension: ["employeepension", "employeespension", "pensionemployee"],
  paye: ["paye", "tax", "incometax", "paye tax", "payetax"],
  student_loan: ["studentloan", "studentloans", "sl"],
  other_deductions: ["otherdeductions", "deductions", "other"],
};
export type PayrollColumns = Partial<Record<keyof typeof ALIASES, string>>;
export const PAYROLL_FIELDS: { key: keyof PayrollColumns; label: string }[] = [
  { key: "pay_date", label: "Pay date" },
  { key: "period_start", label: "Period start (optional)" },
  { key: "period_end", label: "Period end (optional)" },
  { key: "employees", label: "Employees" },
  { key: "gross_pay", label: "Gross pay" },
  { key: "employer_ni", label: "Employer NI" },
  { key: "employer_pension", label: "Employer pension" },
  { key: "employee_ni", label: "Employee NI" },
  { key: "employee_pension", label: "Employee pension" },
  { key: "paye", label: "PAYE tax" },
  { key: "student_loan", label: "Student loan" },
  { key: "other_deductions", label: "Other deductions" },
];

export function detectPayrollColumns(headers: string[]): PayrollColumns {
  return detectColumns(headers, ALIASES);
}

/** One row per pay run (a payroll-software summary export). Rows without a pay date or gross pay
 * are skipped and counted so the preview can say so. */
export function parsePayrollRows(rows: Record<string, string>[], c: PayrollColumns) {
  const runs: PayRunInput[] = [];
  let skipped = 0;
  for (const row of rows) {
    const pay = dateCell(row, c.pay_date);
    const gross = numberCell(row, c.gross_pay);
    if (!pay || gross <= 0) {
      skipped++;
      continue;
    }
    const end = dateCell(row, c.period_end) ?? pay;
    runs.push({
      pay_date: pay,
      period_end: end,
      period_start: dateCell(row, c.period_start) ?? end,
      employees: Math.max(0, Math.round(numberCell(row, c.employees))),
      gross_pay: roundMoney(gross),
      employer_ni: roundMoney(numberCell(row, c.employer_ni)),
      employer_pension: roundMoney(numberCell(row, c.employer_pension)),
      employee_ni: roundMoney(numberCell(row, c.employee_ni)),
      employee_pension: roundMoney(numberCell(row, c.employee_pension)),
      paye: roundMoney(numberCell(row, c.paye)),
      student_loan: roundMoney(numberCell(row, c.student_loan)),
      other_deductions: roundMoney(numberCell(row, c.other_deductions)),
    });
  }
  return { runs, skipped };
}
