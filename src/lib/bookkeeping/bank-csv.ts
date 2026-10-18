export type BankColumns = {
  date?: string;
  description?: string;
  amount?: string;
  debit?: string;
  credit?: string;
};

export type ParsedBankTxn = { txn_date: string; description: string; amount: number };

const ALIASES: Record<keyof BankColumns, string[]> = {
  date: ["date", "transactiondate", "txndate", "posteddate", "postingdate", "valuedate", "bookingdate", "processeddate"],
  description: [
    "description",
    "details",
    "transactiondescription",
    "narrative",
    "memo",
    "payee",
    "name",
    "particulars",
    "reference",
    "transactiondetails",
  ],
  amount: ["amount", "value", "transactionamount", "amountgbp", "netamount"],
  debit: ["debit", "paidout", "moneyout", "withdrawal", "withdrawals", "out", "debitamount", "paymentsout"],
  credit: ["credit", "paidin", "moneyin", "deposit", "deposits", "in", "creditamount", "paymentsin"],
};

function norm(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Guesses which spreadsheet columns hold the date / description / amount (or debit+credit). */
export function detectBankColumns(headers: string[]): BankColumns {
  const result: BankColumns = {};
  for (const key of Object.keys(ALIASES) as (keyof BankColumns)[]) {
    const match = headers.find((h) => ALIASES[key].includes(norm(h)));
    if (match) result[key] = match;
  }
  return result;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function isoFrom(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const year = y < 100 ? 2000 + y : y;
  const date = new Date(Date.UTC(year, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null;
  return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Parses UK-style bank dates: 2026-08-14, 14/08/2026, 14-08-26, 14 Aug 2026, 14-Aug-26.
 * Slash dates are read day-first unless the second number can only be a day (e.g. 08/14/2026). */
export function parseBankDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return isoFrom(Number(m[1]), Number(m[2]), Number(m[3]));

  m = s.match(/^(\d{1,2})[/.\-\s]([A-Za-z]{3,9})[/.\-\s,]*(\d{2,4})/);
  if (m) {
    const month = MONTHS[m[2].toLowerCase().slice(0, 4)] ?? MONTHS[m[2].toLowerCase().slice(0, 3)];
    if (month) return isoFrom(Number(m[3]), month, Number(m[1]));
  }

  m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = Number(m[3]);
    if (b > 12 && a <= 12) return isoFrom(y, a, b);
    return isoFrom(y, b, a);
  }
  return null;
}

/** Parses "£1,234.50", "(45.00)", "1,234.50-", "45.00 DR". Returns NaN if it isn't a number. */
export function parseBankAmount(raw: string): number {
  let s = raw.trim();
  if (!s) return NaN;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (/\bdr\b\.?$/i.test(s)) {
    negative = true;
    s = s.replace(/\bdr\b\.?$/i, "");
  }
  s = s.replace(/\bcr\b\.?$/i, "");
  if (s.endsWith("-")) {
    negative = true;
    s = s.slice(0, -1);
  }
  s = s.replace(/[£$€,\s]/g, "");
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  if (!/^\d*\.?\d+$/.test(s)) return NaN;
  const n = Number(s);
  return negative ? -n : n;
}

/** Turns spreadsheet rows into transactions (money in positive, money out negative). */
export function parseBankRows(
  rows: Record<string, string>[],
  columns: BankColumns,
  options: { invertSigns?: boolean } = {}
): { transactions: ParsedBankTxn[]; skipped: number; problems: string[] } {
  const transactions: ParsedBankTxn[] = [];
  const problems: string[] = [];
  let skipped = 0;

  if (!columns.date || !columns.description || (!columns.amount && !columns.debit && !columns.credit)) {
    return { transactions, skipped: rows.length, problems: ["Pick the date, description and amount columns."] };
  }

  rows.forEach((row, i) => {
    const date = parseBankDate(String(row[columns.date!] ?? ""));
    const description = String(row[columns.description!] ?? "").replace(/\s+/g, " ").trim();

    let amount = NaN;
    if (columns.amount) {
      amount = parseBankAmount(String(row[columns.amount] ?? ""));
    } else {
      const debit = columns.debit ? parseBankAmount(String(row[columns.debit] ?? "")) : NaN;
      const credit = columns.credit ? parseBankAmount(String(row[columns.credit] ?? "")) : NaN;
      if (!Number.isNaN(credit) || !Number.isNaN(debit)) {
        amount = (Number.isNaN(credit) ? 0 : Math.abs(credit)) - (Number.isNaN(debit) ? 0 : Math.abs(debit));
      }
    }

    if (!date || !description || Number.isNaN(amount) || amount === 0) {
      skipped++;
      if (problems.length < 5 && (date || description)) problems.push(`Row ${i + 2} skipped (couldn't read date or amount).`);
      return;
    }
    transactions.push({
      txn_date: date,
      description,
      amount: Math.round((options.invertSigns ? -amount : amount) * 100) / 100,
    });
  });

  return { transactions, skipped, problems };
}

/** Stable key for "same payee" lookups: drops digits, punctuation and banking boilerplate
 * so "CARD PAYMENT TO TESCO 1234 ON 12 AUG" and "... 5678 ON 13 AUG" group together. */
const NOISE = new Set([
  "card", "payment", "payments", "to", "from", "on", "ref", "faster", "fp", "bacs", "dd", "direct", "debit", "credit",
  "pos", "visa", "purchase", "transaction", "transfer", "bgc", "chq", "the", "of", "and", "ltd", "limited", "uk", "gb",
]);

export function payeeKey(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !NOISE.has(t) && !/\d/.test(t))
    .slice(0, 3)
    .join(" ");
}

/** Identifies a statement line so re-importing an overlapping statement skips lines already
 * stored. `occurrence` separates genuinely repeated lines (two identical £3.50 coffees). */
export function bankFingerprint(t: ParsedBankTxn, occurrence: number): string {
  const desc = t.description.toLowerCase().replace(/\s+/g, " ").trim();
  return `${t.txn_date}|${t.amount.toFixed(2)}|${desc}|${occurrence}`;
}
