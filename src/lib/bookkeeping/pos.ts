import { roundMoney } from "@/lib/format";
import { dateCell, detectColumns, numberCell } from "./csv-map";

export type PosDay = {
  sales_date: string;
  location: string;
  gross_sales: number;
  net_sales: number;
  vat_amount: number;
  cash_total: number;
  card_total: number;
  other_total: number;
  tips: number;
  refunds: number;
  discounts: number;
  service_charge: number;
  transactions: number;
};

const ALIASES = {
  sales_date: ["date", "salesdate", "businessdate", "day", "reportdate"],
  location: ["location", "site", "venue", "outlet", "store"],
  gross_sales: ["gross", "grosssales", "totalsales", "grosstakings", "totalgross", "takings"],
  net_sales: ["net", "netsales", "netexvat", "salesexvat", "nettakings"],
  vat_amount: ["vat", "tax", "vatamount", "taxes", "totaltax", "salestax"],
  cash_total: ["cash", "cashsales", "cashtotal", "cashpayments", "cashtakings"],
  card_total: ["card", "cardsales", "cardtotal", "cardpayments", "cardtakings"],
  other_total: ["other", "othersales", "othertotal", "otherpayments", "voucher", "vouchers"],
  tips: ["tips", "gratuity", "tip"],
  refunds: ["refunds", "refund", "returns"],
  discounts: ["discounts", "discount", "comps"],
  service_charge: ["servicecharge", "service", "svc"],
  transactions: ["transactions", "covers", "orders", "checks", "salescount", "transactioncount"],
};
export type PosColumns = Partial<Record<keyof typeof ALIASES, string>>;
export const POS_FIELDS: { key: keyof PosColumns; label: string }[] = [
  { key: "sales_date", label: "Date" },
  { key: "location", label: "Location (optional)" },
  { key: "gross_sales", label: "Gross sales (inc VAT)" },
  { key: "net_sales", label: "Net sales (ex VAT)" },
  { key: "vat_amount", label: "VAT" },
  { key: "cash_total", label: "Cash" },
  { key: "card_total", label: "Card" },
  { key: "other_total", label: "Other payments" },
  { key: "tips", label: "Tips" },
  { key: "refunds", label: "Refunds" },
  { key: "discounts", label: "Discounts" },
  { key: "service_charge", label: "Service charge" },
  { key: "transactions", label: "Transactions" },
];

export function detectPosColumns(headers: string[]): PosColumns {
  return detectColumns(headers, ALIASES);
}

/** Reads a POS end-of-day export. Whichever of gross / net / VAT is missing is derived from the
 * other two; if only payment totals exist, gross falls back to their sum. Rows for the same
 * date + location are merged so a per-shift export still lands as one day. */
export function parsePosRows(rows: Record<string, string>[], c: PosColumns) {
  const byKey = new Map<string, PosDay>();
  let skipped = 0;
  for (const row of rows) {
    const date = dateCell(row, c.sales_date);
    if (!date) {
      skipped++;
      continue;
    }
    const cash = numberCell(row, c.cash_total);
    const card = numberCell(row, c.card_total);
    const other = numberCell(row, c.other_total);
    let gross = numberCell(row, c.gross_sales);
    let net = numberCell(row, c.net_sales);
    let vat = numberCell(row, c.vat_amount);
    if (!gross && net && vat) gross = net + vat;
    if (!gross) gross = cash + card + other;
    if (!net && gross && vat) net = gross - vat;
    if (!vat && gross && net) vat = gross - net;
    if (!net) net = gross; // no VAT information at all: treat as zero-rated rather than invent VAT
    if (gross <= 0 && !cash && !card && !other) {
      skipped++;
      continue;
    }
    const location = (c.location ? (row[c.location] ?? "").toString().trim() : "").slice(0, 80) || "Main";
    const day: PosDay = {
      sales_date: date,
      location,
      gross_sales: gross,
      net_sales: net,
      vat_amount: vat,
      cash_total: cash,
      card_total: card,
      other_total: other,
      tips: numberCell(row, c.tips),
      refunds: Math.abs(numberCell(row, c.refunds)),
      discounts: Math.abs(numberCell(row, c.discounts)),
      service_charge: numberCell(row, c.service_charge),
      transactions: Math.round(numberCell(row, c.transactions)),
    };
    const key = `${date}|${location}`;
    const cur = byKey.get(key);
    if (!cur) {
      byKey.set(key, day);
      continue;
    }
    for (const k of Object.keys(day) as (keyof PosDay)[]) {
      if (k !== "sales_date" && k !== "location") (cur[k] as number) += day[k] as number;
    }
  }
  const days = [...byKey.values()].map((d) => {
    const out = { ...d };
    for (const k of Object.keys(out) as (keyof PosDay)[]) {
      if (k !== "sales_date" && k !== "location" && k !== "transactions") (out[k] as number) = roundMoney(out[k] as number);
    }
    return out;
  });
  return { days, skipped };
}

const PROCESSORS = ["sumup", "square", "worldpay", "stripe", "dojo", "zettle", "izettle", "teya", "takepayments", "paypal", "elavon", "barclaycard", "lloyds cardnet", "adyen", "shopify"];

/** Whether a bank line looks like a card-processor payout. */
export function isProcessorDeposit(description: string): boolean {
  const d = description.toLowerCase();
  return PROCESSORS.some((p) => d.includes(p));
}

/** Card takings settle 1–3 working days later, so compare a window with a lag allowance. */
export function settlementCheck(cardTakings: number, deposits: number) {
  const gap = roundMoney(cardTakings - deposits);
  const pct = cardTakings > 0 ? gap / cardTakings : 0;
  return { gap, pct, short: gap > 5 && pct > 0.05 };
}
