import { EXPENSE_CATEGORIES, STOCK_GROUPS } from "@/lib/bookkeeping/categories";
import { DENOMINATIONS } from "@/lib/cashup";
import { roundMoney, roundQty } from "@/lib/format";
import { cleanPropertyDetails, type PropertyDetails } from "@/lib/property";
import { groupForSupplierType, guessSupplierType, isSupplierType, isUnreadable, SUPPLIER_TYPE_NAMES, unreadableName } from "@/lib/bookkeeping/supplier-types";

/** Reads structured data out of a photo — a receipt, a supplier bill, or a till/cash-register
 * total — using Claude's vision. Every field the model returns is treated as a suggestion: the
 * caller always pre-fills a normal editable form with it rather than saving anything directly, so
 * a misread number is a quick edit, not a wrong figure in the books. */

export type ScanKind = "receipt" | "bill" | "till" | "list" | "statement" | "credit_note" | "fuel";

/** A fuel receipt from a filling station, with what is needed to reclaim its VAT. */
export type FuelExtraction = {
  kind: "fuel";
  station: string | null;
  stationVatNumber: string | null;
  date: string | null;
  fuelType: string | null;
  litres: number | null;
  pricePerLitre: number | null;
  /** The amount paid including VAT. */
  total: number | null;
  /** The VAT amount as printed, if it is. */
  vatAmount: number | null;
  paymentMethod: "cash" | "card" | null;
  /** A vehicle registration printed on the receipt (fleet cards often print it). */
  registration: string | null;
};

/** One row of a bank statement as printed. `datePrinted` is exactly what the date column shows
 * ("03 AUG", "02 SEP 2026") or empty when the row shares the date of the row above. */
export type StatementRowRaw = {
  datePrinted: string | null;
  description: string;
  paidIn: number | null;
  withdrawn: number | null;
  balance: number | null;
};

export type StatementExtraction = {
  kind: "statement";
  accountName: string | null;
  accountLabel: string | null;
  accountNumber: string | null;
  sortCode: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  openingBalance: number | null;
  closingBalance: number | null;
  totalPaidIn: number | null;
  totalWithdrawn: number | null;
  page: number | null;
  totalPages: number | null;
  rows: StatementRowRaw[];
};

/** One printed line of a receipt. `amount` is exactly what was printed for the line (negative for a
 * discount or coupon) — whether it includes VAT is told by the receipt's `pricesIncludeVat`. */
export type ReceiptLine = {
  description: string;
  qty: number;
  amount: number;
  vatRate: number | null;
  category: string | null;
  /** For stock items: the kind of product (Meat & poultry, Fruit & veg, Dairy & eggs…). */
  itemGroup: string | null;
  /** Goods bought to sell or use up (food, drink, ingredients) rather than a one-off cost. */
  isStock: boolean;
};

export type ReceiptExtraction = {
  kind: "receipt";
  payee: string | null;
  date: string | null;
  paymentMethod: "cash" | "card" | "bank" | null;
  /** True when line prices already include VAT, false when VAT is added at the bottom (trade
   * receipts such as Costco), null when the receipt doesn't say. */
  pricesIncludeVat: boolean | null;
  lines: ReceiptLine[];
  /** The VAT table if the receipt prints one: net and VAT per rate. */
  vatSummary: { rate: number; net: number | null; vat: number | null }[];
  netTotal: number | null;
  vatTotal: number | null;
  grossTotal: number | null;
  /** What was handed over (cash given, or the card amount) and the change given back, where printed. */
  amountTendered: number | null;
  changeGiven: number | null;
  category: string | null;
  notes: string | null;
};

export type BillLine = {
  description: string;
  qty: number;
  unitCost: number;
  vatRate: number;
  /** kg, box, case… as written, if it is. */
  unit?: string | null;
  /** Stock category (Fish & seafood, Fruit & veg…), from the line or else from the kind of supplier. */
  itemGroup?: string | null;
};
export type BillExtraction = {
  kind: "bill";
  vendorName: string | null;
  /** What kind of business the supplier is (see supplier-types), read or guessed from the letterhead. */
  supplierType: string | null;
  billNumber: string | null;
  date: string | null;
  dueDate: string | null;
  /** Lines as printed. `unitCost` is before VAT unless `pricesIncludeVat` is true — see bill-math. */
  lines: BillLine[];
  pricesIncludeVat: boolean | null;
  netTotal: number | null;
  vatTotal: number | null;
  grossTotal: number | null;
  /** Letting-agent / property facts (managed property, rent received, balance due, tenancy dates), if the document has them. */
  property: PropertyDetails | null;
};

/** A credit note from a supplier: money they owe back to the business (a return, a refunded
 * deposit, a price correction). Amounts are positive, as printed. */
export type CreditNoteLine = { description: string; qty: number; unitPrice: number; net: number; vatRate: number; vat: number };
export type CreditNoteExtraction = {
  kind: "credit_note";
  supplierName: string | null;
  supplierVatNumber: string | null;
  creditNoteNumber: string | null;
  date: string | null;
  /** The invoice, order or PO number the credit is against. */
  originalInvoiceRef: string | null;
  /** The supplier's account code for this business. */
  accountReference: string | null;
  reason: string | null;
  lines: CreditNoteLine[];
  netTotal: number | null;
  vatTotal: number | null;
  grossTotal: number | null;
};

export type TillExtraction = {
  kind: "till";
  total: number | null;
  denominations: Partial<Record<(typeof DENOMINATIONS)[number]["key"], number>> | null;
};

export type ListLine = { description: string; qty: number; unit: string | null };
export type ListExtraction = { kind: "list"; items: ListLine[] };

export type ScanExtraction = ReceiptExtraction | BillExtraction | TillExtraction | ListExtraction | StatementExtraction | CreditNoteExtraction | FuelExtraction;

/** The key as saved in the host's settings, tolerating the stray spaces, line breaks or quote
 * marks that often come along when it's pasted in. */
function anthropicKey(): string {
  return (process.env.ANTHROPIC_API_KEY ?? "").trim().replace(/^["']+|["']+$/g, "").trim();
}

export function scanConfigured(): boolean {
  return !!anthropicKey();
}

const VAT_RATE_ENUM = [0, 5, 20];
const DENOM_KEYS = DENOMINATIONS.map((d) => d.key);

const TOOLS: Record<ScanKind, { name: string; description: string; input_schema: Record<string, unknown> }> = {
  receipt: {
    name: "record_receipt",
    description: "Structured data read from a photo of a single purchase receipt, every printed line included.",
    input_schema: {
      type: "object",
      properties: {
        payee: { type: "string", description: "The shop or business's trading name (e.g. \"Costco Wholesale\", \"Primark\"), not the address or legal entity if a shorter trading name is printed." },
        date: { type: "string", description: "Date of the transaction, as YYYY-MM-DD. Omit if not legible." },
        payment_method: {
          type: "string",
          enum: ["cash", "card", "bank"],
          description: "How it was paid — only if the document actually says or shows it (cash, a card payment, or 'bank' for a bank transfer or an invoice with bank details to pay into). Leave it out if unclear.",
        },
        prices_include_vat: {
          type: "boolean",
          description:
            "true if the line prices already include VAT (typical retail receipt). false if line prices are BEFORE VAT and the VAT is added at the bottom (trade receipts: look for 'TOTAL (EXCL VAT)', 'VAT Amount', 'TOTAL (INCL VAT)', or line prices that add up to the ex-VAT total). Omit if the receipt shows no VAT information at all.",
        },
        lines: {
          type: "array",
          description: "EVERY printed item line, in order, each as one entry — do not merge, skip or summarise lines. Include discount/coupon lines as negative amounts.",
          items: {
            type: "object",
            properties: {
              description: { type: "string", description: "The item name, tidied into readable words (e.g. 'KS ROTISS CHICKEN' -> 'Rotisserie Chicken', 'NDTR MIFFY SHERPA' -> 'Miffy Sherpa'). Keep size/pack info such as '2x750ml'." },
              qty: { type: "number", description: "Quantity bought, e.g. from '2 x' or '3x'. Use 1 if not shown." },
              amount: { type: "number", description: "The amount printed for this line (the line total, not the unit price when qty > 1). Negative for a discount, coupon, rebate or a number with a trailing minus (e.g. '6.00-')." },
              vat_rate: { type: "number", enum: VAT_RATE_ENUM, description: "This line's UK VAT rate, using the receipt's VAT code legend where there is one (e.g. 'A' = 20%, 'Z' = 0%). Omit if it cannot be told." },
              category: { type: "string", enum: [...EXPENSE_CATEGORIES], description: "The best-matching business expense category for this item." },
              is_stock: { type: "boolean", description: "true for food, drink and ingredients or goods bought to sell or use up in a kitchen; false for one-off costs like clothing, tools, equipment, fuel or fees." },
              item_group: { type: "string", enum: [...STOCK_GROUPS], description: "For stock items only: the kind of product it is (e.g. chicken -> 'Meat & poultry', bananas -> 'Fruit & veg', yoghurt -> 'Dairy & eggs')." },
            },
            required: ["description", "amount"],
          },
        },
        vat_summary: {
          type: "array",
          description: "The VAT breakdown table if one is printed (one row per VAT rate): the net amount and the VAT amount for that rate, exactly as printed.",
          items: {
            type: "object",
            properties: {
              rate: { type: "number", enum: VAT_RATE_ENUM },
              net: { type: "number", description: "Amount excluding VAT for this rate, as printed." },
              vat: { type: "number", description: "VAT amount for this rate, as printed." },
            },
            required: ["rate"],
          },
        },
        net_total: { type: "number", description: "Total excluding VAT, as printed. Omit if not printed." },
        vat_total: { type: "number", description: "Total VAT, as printed. Omit if not printed." },
        gross_total: {
          type: "number",
          description:
            "The final total paid including VAT, as printed. If it is hidden or smudged (e.g. blacked out), work it out as the ex-VAT total plus VAT, or the cash/card tendered minus any change, and only if you can see those numbers.",
        },
        amount_tendered: { type: "number", description: "The amount handed over or tendered (e.g. the 'Cash' line, £420.00), as printed — which can be MORE than the total when change is given. Omit if not printed." },
        change_given: { type: "number", description: "The change given back to the customer ('Change', 'Change Cash'), as a positive number. Omit if there was none." },
        category: { type: "string", enum: [...EXPENSE_CATEGORIES], description: "The single best category for the receipt overall." },
        notes: { type: "string", description: "A short one-line description of what was purchased, if useful." },
      },
      required: ["payee", "lines"],
    },
  },
  statement: {
    name: "record_bank_statement",
    description: "Structured data read from a photo of a bank statement page: the account, the period, the balances and every transaction row.",
    input_schema: {
      type: "object",
      properties: {
        account_name: { type: "string", description: "The account holder name printed at the top (e.g. the company name)." },
        account_label: { type: "string", description: "The type of account printed with it, e.g. 'BUSINESS CURRENT ACCOUNT' or 'BUSINESS RESERVE'." },
        account_number: { type: "string", description: "The account number, digits only." },
        sort_code: { type: "string", description: "The sort code, e.g. 60-17-36." },
        period_from: { type: "string", description: "First day covered by the statement, YYYY-MM-DD (from 'Period Covered')." },
        period_to: { type: "string", description: "Last day covered by the statement, YYYY-MM-DD (from 'Period Covered')." },
        opening_balance: { type: "number", description: "The balance at the start: 'Previous Balance' in the summary box, or the BROUGHT FORWARD row." },
        closing_balance: { type: "number", description: "The balance at the end: 'New Balance' in the summary box." },
        total_paid_in: { type: "number", description: "The 'Paid In' total from the summary box." },
        total_withdrawn: { type: "number", description: "The 'Withdrawn' total from the summary box." },
        page: { type: "integer", description: "This page's number, from 'Page No 1 of 2'." },
        total_pages: { type: "integer", description: "Total pages, from 'Page No 1 of 2'." },
        transactions: {
          type: "array",
          description:
            "EVERY transaction row in the table, in order, one entry each. Do NOT include BROUGHT FORWARD or CARRIED FORWARD rows (give those balances as opening/closing balance instead). A description that wraps onto a second line is still ONE transaction — join the lines and keep the reference numbers.",
          items: {
            type: "object",
            properties: {
              date_printed: {
                type: "string",
                description:
                  "The date exactly as printed in the Date column for this row (e.g. '03 AUG' or '02 SEP 2026'). Leave it out when the Date column is blank for this row — that means it happened on the same day as the row above.",
              },
              description: { type: "string", description: "The full description text for this row." },
              paid_in: { type: "number", description: "The amount in the 'Paid In' column, if there is one on this row." },
              withdrawn: { type: "number", description: "The amount in the 'Withdrawn' column, if there is one on this row." },
              balance: { type: "number", description: "The running balance printed on this row, if shown." },
            },
            required: ["description"],
          },
        },
      },
      required: ["transactions"],
    },
  },
  bill: {
    name: "record_bill",
    description: "Structured data read from a photo of a supplier invoice or bill, including its line items.",
    input_schema: {
      type: "object",
      properties: {
        vendor_name: { type: "string", description: "The supplier's business name." },
        vendor_address: { type: "string", description: "The supplier's address as printed in the letterhead (it often names the market, e.g. Billingsgate or New Spitalfields)." },
        supplier_type: {
          type: "string",
          enum: [...SUPPLIER_TYPE_NAMES],
          description:
            "What kind of business the supplier is, from its name, letterhead and what it sells: e.g. a Billingsgate Market stand or 'Shellfish'/'Marine Foods' -> 'Fish market / fishmonger'; a New Spitalfields Market stand or 'Veg' -> 'Fruit & veg wholesaler'; Smithfield -> 'Butcher / meat wholesaler'.",
        },
        bill_number: { type: "string", description: "The supplier's own invoice/bill number." },
        date: { type: "string", description: "Invoice date, as YYYY-MM-DD." },
        date_has_year: { type: "boolean", description: "false if the date as written has no year (e.g. '16/10'); true if a year is written." },
        due_date: { type: "string", description: "Payment due date, as YYYY-MM-DD, if shown." },
        prices_include_vat: {
          type: "boolean",
          description:
            "true if the printed line prices already include VAT (shop receipts, or wording like 'inc VAT' / 'VAT included in the price above'). false if the line prices are before VAT and VAT is added on top. Omit if the document shows no VAT information.",
        },
        net_total: { type: "number", description: "Total before VAT, as printed. Omit if not printed." },
        vat_total: { type: "number", description: "Total VAT, as printed. Omit if not printed." },
        gross_total: { type: "number", description: "Final total payable including VAT, as printed. Omit if not printed." },
        property_statement: {
          type: "object",
          description:
            "ONLY for a letting / property-management agent's invoice or statement: the property facts printed on it. Leave the whole object out for any other document. Copy every one of these that is printed.",
          properties: {
            managed_property: { type: "string", description: "The address after 'Re: Managed Property at'." },
            our_ref: { type: "string", description: "'Our Ref' (the agent's reference for the property)." },
            location: { type: "string", description: "'Location' code." },
            vat_reg_no: { type: "string", description: "The agent's VAT registration number." },
            description: { type: "string", description: "What the invoice is for, e.g. 'To agreed management fees for the above property inc VAT'." },
            current_rent_date: { type: "string", description: "'Current rent date', YYYY-MM-DD (day-first in the original)." },
            rent_review_date: { type: "string", description: "'Rent review date', YYYY-MM-DD." },
            discuss_with_agent_date: { type: "string", description: "'Discuss with agent date', YYYY-MM-DD." },
            rent_received: { type: "number", description: "'Rent received' in the Statement of Account." },
            invoice_amount: { type: "number", description: "'Less our invoice as above' — the invoice amount (the fee including VAT)." },
            vat_included: { type: "number", description: "The VAT included in the fee ('included in our fee above is the VAT @ 20%')." },
            expenses_paid: { type: "number", description: "'Less expenses paid on your behalf'." },
            balance_due: { type: "number", description: "'Balance due to you'." },
            paid_to_sort_code: { type: "string", description: "Sort code the balance was paid to." },
            paid_to_account: { type: "string", description: "Account number the balance was paid to." },
          },
        },
        lines: {
          type: "array",
          description: "Each distinct product or service line on the bill.",
          items: {
            type: "object",
            properties: {
              description: {
                type: "string",
                description:
                  "What the item is, in plain words (fish/trade codes spelled out where you are sure, e.g. 'TBO' on a fish ticket -> 'Turbot'). If the handwriting can't be read, write 'Unreadable item' rather than guessing a name.",
              },
              qty: {
                type: "number",
                description:
                  "Quantity in the unit given by `unit`. Handwritten trade shorthand: '5k' = 5 kg; '1/10' = 1 box of 10 kg (qty 1, unit 'box of 10kg'); a weight written above or beside the line (e.g. '8.00') is the quantity when quantity × price per kg gives the line total. Default to 1 if not shown.",
              },
              unit: { type: "string", description: "The unit the quantity is in, if written: kg, box, case, bag, each…" },
              unit_cost: { type: "number", description: "Cost per unit EXACTLY AS PRINTED — do not add or remove VAT yourself; prices_include_vat says which it is. Negative for a discount or credit." },
              line_total: {
                type: "number",
                description: "The amount in the £ / total column for this line, exactly as written. On handwritten market slips this is usually the only price — the line total, not a price per kg.",
              },
              item_group: { type: "string", enum: [...STOCK_GROUPS], description: "The stock category of this item. When the description is unreadable, use what the supplier sells (a fishmonger -> 'Fish & seafood')." },
              vat_rate: { type: "number", enum: VAT_RATE_ENUM, description: "This line's UK VAT rate — 0, 5 or 20. A short code printed on the line (A, 0, 1…) is NOT the rate: look it up in the VAT table or key. If the document says VAT @ 20% overall, use 20." },
            },
            required: ["description", "unit_cost"],
          },
        },
      },
      required: ["lines"],
    },
  },
  fuel: {
    name: "record_fuel_receipt",
    description: "Structured data read from a photo of a filling-station fuel receipt.",
    input_schema: {
      type: "object",
      properties: {
        station: { type: "string", description: "The filling station's trading name (e.g. 'Shell Charlton', 'Tesco Petrol Filling Station', 'BP')." },
        station_vat_number: { type: "string", description: "The VAT registration number printed on the receipt (e.g. 'VAT No: GB 123 4567 89'), digits and GB prefix only. Omit if not printed." },
        date: { type: "string", description: "Date of the purchase, as YYYY-MM-DD. UK dates are day-first." },
        fuel_type: { type: "string", enum: ["Diesel", "Petrol", "LPG", "Electric", "AdBlue"], description: "The fuel bought (Unleaded / Super unleaded = Petrol)." },
        litres: { type: "number", description: "Litres bought, as printed." },
        price_per_litre: { type: "number", description: "Price per litre in pounds as printed (e.g. 1.459 for 145.9p/L)." },
        total: { type: "number", description: "The total paid for the fuel including VAT, as printed." },
        vat_amount: { type: "number", description: "The VAT amount as printed, if the receipt shows one." },
        payment_method: { type: "string", enum: ["cash", "card"], description: "How it was paid, if shown." },
        registration: { type: "string", description: "A vehicle registration printed on the receipt (fuel cards often print it), if any." },
      },
      required: ["station"],
    },
  },
  credit_note: {
    name: "record_credit_note",
    description: "Structured data read from a photo of a supplier's credit note: who issued it, its number, date, what it is against, every line and the totals.",
    input_schema: {
      type: "object",
      properties: {
        supplier_name: { type: "string", description: "The trading name of the business that ISSUED the credit note (the supplier, usually in the logo or letterhead) — not the customer it is addressed to." },
        supplier_vat_number: { type: "string", description: "The supplier's VAT registration number (e.g. GB177181489), if printed." },
        credit_note_number: { type: "string", description: "The credit note's own number (e.g. 'Sales Credit Note Number: 28287' -> '28287')." },
        date: { type: "string", description: "The credit note date, as YYYY-MM-DD. UK dates are day-first: 02/10/2026 is 2 October 2026." },
        original_invoice_ref: { type: "string", description: "The invoice, order or PO number this credit is against, if printed (e.g. 'Customer PO: INV 555524', 'Original invoice', 'Against invoice')." },
        account_reference: { type: "string", description: "The supplier's account reference/code for the customer, if printed." },
        reason: { type: "string", description: "Why the credit was given, if the document says or it is obvious from the lines (e.g. 'Gas cylinder deposits returned', 'Damaged goods'). Short." },
        lines: {
          type: "array",
          description: "EVERY line on the credit note, in order. Amounts are POSITIVE as printed even though they are a credit.",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              qty: { type: "number", description: "Quantity. 1 if not shown." },
              unit_price: { type: "number", description: "Unit price as printed, before VAT." },
              net_amount: { type: "number", description: "The line's net (before VAT) amount as printed." },
              vat_rate: { type: "number", enum: VAT_RATE_ENUM, description: "The line's VAT %, 0, 5 or 20." },
              vat_amount: { type: "number", description: "The line's VAT amount as printed, if shown." },
            },
            required: ["description", "net_amount"],
          },
        },
        net_total: { type: "number", description: "Total net amount, as printed." },
        vat_total: { type: "number", description: "Total VAT amount, as printed." },
        gross_total: { type: "number", description: "The credit note total including VAT, as printed." },
      },
      required: ["lines"],
    },
  },
  till: {
    name: "record_till_count",
    description: "The cash total from a photo of a till display, a counted-cash slip, or physical notes and coins laid out to be counted.",
    input_schema: {
      type: "object",
      properties: {
        total: { type: "number", description: "The total cash amount shown or counted." },
        denominations: {
          type: "object",
          description: "Only fill this in if individual notes/coins are actually laid out and countable in the photo — leave it out entirely for a till receipt or a screen showing just a total.",
          properties: Object.fromEntries(
            DENOMINATIONS.map((d) => [
              d.key,
              {
                type: "integer",
                description: `How many ${d.label} ${d.key.startsWith("n") ? "notes" : "coins"} (each worth ${d.value >= 1 ? `£${d.value}` : `${Math.round(d.value * 100)} pence`}) — the ${d.label} ${d.key.startsWith("n") ? "note" : "coin"} only, not any other denomination.`,
              },
            ])
          ),
        },
      },
      required: ["total"],
    },
  },
  list: {
    name: "record_item_list",
    description: "Every distinct item and its quantity, read from a photo of physical stock (a shelf, a fridge, a stockroom) or from a written or printed order/delivery list.",
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          description: "One entry per distinct item.",
          items: {
            type: "object",
            properties: {
              description: { type: "string", description: "The item's name, as written or as it would normally be called." },
              qty: { type: "number", description: "How many/much — count what's visible, or read the written quantity." },
              unit: { type: "string", description: "The unit, e.g. kg, case, bottle, box, unit — only if it's actually shown or obvious from the photo." },
            },
            required: ["description", "qty"],
          },
        },
      },
      required: ["items"],
    },
  },
};

function systemPromptFor(kind: ScanKind): string {
  const today = new Date().toISOString().slice(0, 10);
  const base = `You read UK retail and hospitality documents precisely. Only report figures you can actually see — never estimate or invent a value that isn't legible, and simply omit a field you can't read rather than guessing. Today is ${today}: a date written without a year (e.g. '16/10') is in the most recent year that doesn't put it in the future.`;
  if (kind === "receipt")
    return `${base} You are reading a single shop receipt for a business purchase. Transcribe every item line (do not stop early on a long receipt), with its printed amount, quantity and VAT rate. Work out whether the printed line prices include VAT or exclude it (trade receipts often list prices before VAT, with 'TOTAL (EXCL VAT)', a VAT table and 'TOTAL (INCL VAT)' at the bottom — check that the line amounts add up to the ex-VAT total to be sure). Read the VAT table exactly as printed. A receipt that prints no VAT at all (many retail receipts) simply has no VAT information — leave those fields out rather than inventing them. Ignore barcodes, survey codes, loyalty messages and addresses when listing items. A short code printed beside each price (A, 0, 1, T…) is a VAT code, not a rate: find what rate it means in the VAT table or legend (on IKEA receipts code 0 is the 20% row) and use that rate. If no trading name is printed but a web address is (www.amazon.co.uk), the payee is the brand ("Amazon"). Record the cash handed over and the change given back when printed (amount_tendered, change_given); the total paid is the receipt's Total, not the cash handed over. A multi-buy line such as '4 for 3' with a negative amount is a discount on the item printed just above it: list that item at its full printed price AND the discount as its own negative line — never drop the item. Dates on UK receipts are day-first: 05.08.26 is 5 August 2026, never 8 May.`;
  if (kind === "bill") return `${base} You are reading a supplier invoice or delivery note addressed to the business, listing what was bought and at what cost. A discount, credit or "less" line is a line too: give it a NEGATIVE unit cost. A multi-buy line such as '4 for 3' with a negative amount is a discount on the item printed just above it: list that item at its full printed price AND the discount as its own negative line — never drop the item. Copy each price exactly as printed and say whether the prices include VAT (prices_include_vat): shop receipts and lines worded "inc VAT" include it; Net / VAT / Total columns usually mean the prices are before VAT. Read the printed totals too. UK dates are day-first (05.08.26 is 5 August 2026). The supplier name is the business's trading name; if only a web address is printed (e.g. www.amazon.co.uk) use the brand ("Amazon"). For a letting or property-management agent's invoice, the charge itself is the fee line; put the rent received, expenses paid, balance due, property address and the tenancy dates in property_statement instead of making them invoice lines. Many market slips (Billingsgate, New Spitalfields) are handwritten: the £ and p columns give each line's total ('45 -' is £45.00), the number in the printed box at the bottom is the grand total, and quantity × unit price must equal the line total — if it doesn't, the line total is right and the quantity or unit price was misread. The oval stamp like 'GB TH017.002' is a food health mark, not a VAT number or invoice number. The name written by hand after 'To', 'M' or 'Customer' is the buyer, not an item. Fresh fish, fruit and veg are zero-rated (0% VAT).`;
  if (kind === "statement")
    return `${base} You are reading one page of a UK bank statement. Transcribe every transaction row with its description, the date as printed, the Paid In / Withdrawn amount and the running balance. Read the Paid In and Withdrawn columns by their position carefully: money in goes in Paid In, money out in Withdrawn. Also read the summary box (previous balance, paid in, withdrawn, new balance, period covered) exactly as printed. Skip the marketing text and any header or footer text.`;
  if (kind === "fuel")
    return `${base} You are reading a receipt from a filling station for fuel bought for a business vehicle. Read the station's name and its VAT number (needed to reclaim VAT), the date, the fuel, litres, price per litre, the total paid and the VAT amount if it is printed. Ignore shop items, loyalty points and adverts; if the receipt has shop items too, the total is the fuel line only.`;
  if (kind === "credit_note")
    return `${base} You are reading a credit note a supplier has sent to the business (money they owe back or will take off the next bill). The supplier is the business that issued it, not the one it is addressed to. Copy every line and the printed totals exactly, as positive numbers. UK dates are day-first (02/10/2026 is 2 October 2026). Handwriting on the page is just someone's note — ignore it unless it is a figure the print doesn't show.`;
  if (kind === "till") return `${base} You are reading a cash till: either a register's own total display/receipt, or a photo of physical notes and coins someone has counted out.`;
  return `${base} You are reading either physical stock (count what's actually there, item by item) or a written/printed list of items and quantities — list every distinct item you can identify, each with its own quantity.`;
}

export async function extractFromImage(kind: ScanKind, base64: string, mediaType: string): Promise<ScanExtraction> {
  const apiKey = anthropicKey();
  if (!apiKey) throw new Error("AI scanning isn't set up on this server yet.");
  const model = process.env.ANTHROPIC_SCAN_MODEL || "claude-sonnet-5";
  const tool = TOOLS[kind];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: kind === "statement" ? 8192 : 4096,
      system: systemPromptFor(kind),
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
      messages: [
        {
          role: "user",
          content: [
            mediaType === "application/pdf"
              ? { type: "document", source: { type: "base64", media_type: mediaType, data: base64 } }
              : { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: "Read this document and call the tool with what you can actually see." },
          ],
        },
      ],
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 401) throw new Error("AI scanning isn't set up correctly on this server (the Anthropic key was rejected — check ANTHROPIC_API_KEY, then redeploy).");
    if (res.status === 400) throw new Error("Couldn't read that file — try a clearer photo, or a different PDF.");
    throw new Error(`Scan failed (${res.status}). ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as { content?: { type: string; input?: unknown }[]; stop_reason?: string };
  const call = json.content?.find((b) => b.type === "tool_use");
  if (!call || typeof call.input !== "object" || call.input === null) {
    throw new Error("Couldn't read that image — try a clearer, well-lit photo.");
  }
  return normalise(kind, call.input as Record<string, unknown>);
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'" };

function str(v: unknown): string | null {
  const s = (typeof v === "string" ? v : "").replace(/&(amp|lt|gt|quot|#39|apos);/g, (m) => ENTITIES[m]).trim();
  // Placeholders the model sometimes writes instead of leaving a field out.
  if (!s || /^(<\s*)?(unknown|n\/?a|none|null|not (shown|printed|legible))(\s*>)?$/i.test(s)) return null;
  return s.slice(0, 200);
}

/** A date written without a year ("16/10") is in the latest year that doesn't put it in the future. */
function dateWithoutYear(iso: string | null): string | null {
  if (!iso) return null;
  const now = new Date();
  const year = now.getFullYear();
  const candidate = `${year}${iso.slice(4)}`;
  const tomorrow = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);
  return candidate <= tomorrow ? candidate : `${year - 1}${iso.slice(4)}`;
}
function isoDate(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** A name that is really just a web address ("www.amazon.co.uk") becomes the brand ("Amazon"). */
export function brandName(name: string | null): string | null {
  if (!name) return name;
  const m = name.trim().match(/^(?:https?:\/\/)?(?:www\.)?([a-z0-9][a-z0-9-]*)\.(?:co\.uk|com|uk|org|net|io|shop|store)(?:\/\S*)?$/i);
  if (!m) return name;
  const label = m[1].replace(/-/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function propertyFromScan(v: unknown): PropertyDetails | null {
  if (typeof v !== "object" || v === null) return null;
  const r = v as Record<string, unknown>;
  return cleanPropertyDetails({
    property: r.managed_property,
    ourRef: r.our_ref,
    location: r.location,
    vatRegNo: r.vat_reg_no,
    description: r.description,
    currentRentDate: r.current_rent_date,
    rentReviewDate: r.rent_review_date,
    discussWithAgentDate: r.discuss_with_agent_date,
    rentReceived: r.rent_received,
    invoiceAmount: r.invoice_amount,
    vatIncluded: r.vat_included,
    expensesPaid: r.expenses_paid,
    balanceDue: r.balance_due,
    paidToSortCode: r.paid_to_sort_code,
    paidToAccount: r.paid_to_account,
  });
}
function vatRate(v: unknown): number {
  const n = Number(v);
  return VAT_RATE_ENUM.includes(n) ? n : 0;
}

function normalise(kind: ScanKind, input: Record<string, unknown>): ScanExtraction {
  if (kind === "receipt") {
    const category = (c: unknown) => ((EXPENSE_CATEGORIES as readonly string[]).includes(String(c)) ? String(c) : null);
    const money = (v: unknown) => {
      const n = num(v);
      return n === null ? null : roundMoney(n);
    };
    const rawLines = Array.isArray(input.lines) ? input.lines : [];
    const lines: ReceiptLine[] = rawLines
      .map((l) => {
        if (typeof l !== "object" || l === null) return null;
        const rec = l as Record<string, unknown>;
        const description = str(rec.description);
        const amount = money(rec.amount);
        if (!description || amount === null) return null;
        const qty = num(rec.qty);
        return {
          description,
          qty: qty && qty > 0 ? roundQty(qty) : 1,
          amount,
          vatRate: rec.vat_rate !== undefined && VAT_RATE_ENUM.includes(Number(rec.vat_rate)) ? Number(rec.vat_rate) : null,
          category: category(rec.category),
          itemGroup: (STOCK_GROUPS as readonly string[]).includes(String(rec.item_group)) ? String(rec.item_group) : null,
          isStock: rec.is_stock === true,
        };
      })
      .filter((l): l is ReceiptLine => l !== null)
      .slice(0, 120);
    const vatSummary = (Array.isArray(input.vat_summary) ? input.vat_summary : [])
      .map((r) => {
        if (typeof r !== "object" || r === null) return null;
        const rec = r as Record<string, unknown>;
        if (!VAT_RATE_ENUM.includes(Number(rec.rate))) return null;
        return { rate: Number(rec.rate), net: money(rec.net), vat: money(rec.vat) };
      })
      .filter((r): r is { rate: number; net: number | null; vat: number | null } => r !== null);
    const method = String(input.payment_method);
    return {
      kind,
      payee: brandName(str(input.payee)),
      date: isoDate(input.date),
      paymentMethod: method === "cash" || method === "card" || method === "bank" ? method : null,
      pricesIncludeVat: typeof input.prices_include_vat === "boolean" ? input.prices_include_vat : null,
      lines,
      vatSummary,
      netTotal: money(input.net_total),
      vatTotal: money(input.vat_total),
      grossTotal: money(input.gross_total),
      amountTendered: money(input.amount_tendered),
      changeGiven: money(input.change_given),
      category: category(input.category),
      notes: str(input.notes),
    };
  }
  if (kind === "bill") {
    const rawLines = Array.isArray(input.lines) ? input.lines : [];
    const lines: BillLine[] = rawLines
      .map((l): BillLine | null => {
        if (typeof l !== "object" || l === null) return null;
        const rec = l as Record<string, unknown>;
        const description = str(rec.description);
        const q = num(rec.qty);
        let qty = q && q > 0 ? roundQty(q) : 1;
        // With only one line on the slip, the slip's total is that line's total.
        const lineTotal = num(rec.line_total) ?? (rawLines.length === 1 ? num(input.gross_total) : null);
        let unitCost = num(rec.unit_cost);
        // The written line total is what was paid, so when quantity × unit price doesn't reach it one
        // of them was misread. A real price per kg that divides the total into a clean weight (57.60 ÷
        // 7.20 = 8 kg) means the quantity was wrong; otherwise — including when the only price on the
        // slip was copied in as the unit price — the unit price is worked out from the total.
        if (lineTotal !== null && (unitCost === null || Math.abs(qty * unitCost - lineTotal) > 0.01)) {
          const impliedQty = unitCost ? lineTotal / unitCost : 0;
          const cleanWeight = unitCost !== null && Math.abs(unitCost - lineTotal) > 0.01 && impliedQty > 0 && Math.abs(impliedQty * 100 - Math.round(impliedQty * 100)) < 0.01;
          if (cleanWeight) qty = roundQty(impliedQty);
          else unitCost = Math.round((lineTotal / qty) * 10000) / 10000;
        }
        if (!description || unitCost === null) return null; // a negative cost is a discount or credit line — keep it
        const group = String(rec.item_group);
        return {
          description,
          qty,
          unitCost: Math.abs(unitCost * 100 - Math.round(unitCost * 100)) < 1e-6 ? roundMoney(unitCost) : unitCost,
          vatRate: vatRate(rec.vat_rate),
          unit: str(rec.unit),
          itemGroup: (STOCK_GROUPS as readonly string[]).includes(group) ? group : null,
        };
      })
      .filter((l): l is BillLine => l !== null)
      .slice(0, 40);
    const vendorName = brandName(str(input.vendor_name));
    const supplierType = isSupplierType(input.supplier_type) ? input.supplier_type : guessSupplierType(vendorName, str(input.vendor_address));
    const supplierGroup = groupForSupplierType(supplierType);
    for (const l of lines) {
      // A specialist mostly sells one kind of thing, so a line the supplier's category can speak for (an
      // unreadable scrawl, or one with no category of its own) takes it. A line that has its own category
      // keeps it: flour on a packaging supplier's invoice is still flour.
      const unreadable = isUnreadable(l.description);
      l.itemGroup = unreadable ? (supplierGroup ?? l.itemGroup ?? null) : (l.itemGroup ?? supplierGroup ?? null);
      if (unreadable) l.description = unreadableName(supplierType);
    }
    const total = (v: unknown) => {
      const n = num(v);
      return n === null ? null : roundMoney(n);
    };
    return {
      kind,
      vendorName,
      supplierType,
      billNumber: str(input.bill_number),
      date: input.date_has_year === false ? dateWithoutYear(isoDate(input.date)) : isoDate(input.date),
      dueDate: isoDate(input.due_date),
      lines,
      pricesIncludeVat: typeof input.prices_include_vat === "boolean" ? input.prices_include_vat : null,
      netTotal: total(input.net_total),
      vatTotal: total(input.vat_total),
      grossTotal: total(input.gross_total),
      property: propertyFromScan(input.property_statement),
    };
  }
  if (kind === "statement") {
    const money = (v: unknown) => {
      const n = num(v);
      return n === null ? null : roundMoney(n);
    };
    const rawRows = Array.isArray(input.transactions) ? input.transactions : [];
    const rows: StatementRowRaw[] = rawRows
      .map((r) => {
        if (typeof r !== "object" || r === null) return null;
        const rec = r as Record<string, unknown>;
        const description = str(rec.description);
        if (!description) return null;
        const clean = (v: unknown) => {
          const n = money(v);
          return n === null ? null : Math.abs(n);
        };
        return {
          datePrinted: str(rec.date_printed),
          description: String(rec.description).trim().replace(/\s+/g, " ").slice(0, 300),
          paidIn: clean(rec.paid_in),
          withdrawn: clean(rec.withdrawn),
          balance: money(rec.balance),
        };
      })
      .filter((r): r is StatementRowRaw => r !== null)
      .slice(0, 400);
    const int = (v: unknown) => {
      const n = num(v);
      return n !== null && n >= 1 && n <= 99 ? Math.round(n) : null;
    };
    return {
      kind: "statement",
      accountName: str(input.account_name),
      accountLabel: str(input.account_label),
      accountNumber: str(input.account_number),
      sortCode: str(input.sort_code),
      periodFrom: isoDate(input.period_from),
      periodTo: isoDate(input.period_to),
      openingBalance: money(input.opening_balance),
      closingBalance: money(input.closing_balance),
      totalPaidIn: money(input.total_paid_in),
      totalWithdrawn: money(input.total_withdrawn),
      page: int(input.page),
      totalPages: int(input.total_pages),
      rows,
    };
  }
  if (kind === "fuel") {
    const money = (v: unknown) => {
      const n = num(v);
      return n === null ? null : roundMoney(Math.abs(n));
    };
    const ppl = num(input.price_per_litre);
    const method = String(input.payment_method);
    return {
      kind,
      station: brandName(str(input.station)),
      stationVatNumber: str(input.station_vat_number),
      date: isoDate(input.date),
      fuelType: str(input.fuel_type),
      litres: num(input.litres),
      // A price printed in pence (145.9) is per litre in pounds (1.459).
      pricePerLitre: ppl === null ? null : ppl > 20 ? Math.round(ppl * 10) / 10000 : ppl,
      total: money(input.total),
      vatAmount: money(input.vat_amount),
      paymentMethod: method === "cash" || method === "card" ? method : null,
      registration: str(input.registration)?.toUpperCase().replace(/\s+/g, " ") ?? null,
    };
  }
  if (kind === "credit_note") {
    const money = (v: unknown) => {
      const n = num(v);
      return n === null ? null : roundMoney(Math.abs(n));
    };
    const rawLines = Array.isArray(input.lines) ? input.lines : [];
    const lines: CreditNoteLine[] = rawLines
      .map((l) => {
        if (typeof l !== "object" || l === null) return null;
        const rec = l as Record<string, unknown>;
        const description = str(rec.description);
        const net = money(rec.net_amount);
        if (!description || net === null) return null;
        const q = num(rec.qty);
        const qty = q && q > 0 ? roundQty(q) : 1;
        const rate = vatRate(rec.vat_rate);
        return {
          description,
          qty,
          unitPrice: money(rec.unit_price) ?? roundMoney(net / qty),
          net,
          vatRate: rate,
          vat: money(rec.vat_amount) ?? roundMoney((net * rate) / 100),
        };
      })
      .filter((l): l is CreditNoteLine => l !== null)
      .slice(0, 60);
    return {
      kind,
      supplierName: brandName(str(input.supplier_name)),
      supplierVatNumber: str(input.supplier_vat_number),
      creditNoteNumber: str(input.credit_note_number),
      date: isoDate(input.date),
      originalInvoiceRef: str(input.original_invoice_ref),
      accountReference: str(input.account_reference),
      reason: str(input.reason),
      lines,
      netTotal: money(input.net_total),
      vatTotal: money(input.vat_total),
      grossTotal: money(input.gross_total),
    };
  }
  if (kind === "till") {
    const total = num(input.total);
    let denominations: TillExtraction["denominations"] = null;
    if (input.denominations && typeof input.denominations === "object") {
      const rec = input.denominations as Record<string, unknown>;
      const clean: Partial<Record<string, number>> = {};
      for (const k of DENOM_KEYS) {
        const n = num(rec[k]);
        if (n && n > 0) clean[k] = Math.round(n);
      }
      if (Object.keys(clean).length) denominations = clean;
    }
    return { kind: "till", total: total !== null ? roundMoney(Math.abs(total)) : null, denominations };
  }

  const rawItems = Array.isArray(input.items) ? input.items : [];
  const items: ListLine[] = rawItems
    .map((it) => {
      if (typeof it !== "object" || it === null) return null;
      const rec = it as Record<string, unknown>;
      const description = str(rec.description);
      const qty = num(rec.qty);
      if (!description || qty === null || qty <= 0) return null;
      return { description, qty: roundQty(qty), unit: str(rec.unit) };
    })
    .filter((l): l is ListLine => l !== null)
    .slice(0, 100);
  return { kind: "list", items };
}
