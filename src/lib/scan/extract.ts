import { EXPENSE_CATEGORIES, STOCK_GROUPS } from "@/lib/bookkeeping/categories";
import { DENOMINATIONS } from "@/lib/cashup";
import { roundMoney, roundQty } from "@/lib/format";

/** Reads structured data out of a photo — a receipt, a supplier bill, or a till/cash-register
 * total — using Claude's vision. Every field the model returns is treated as a suggestion: the
 * caller always pre-fills a normal editable form with it rather than saving anything directly, so
 * a misread number is a quick edit, not a wrong figure in the books. */

export type ScanKind = "receipt" | "bill" | "till" | "list";

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
  paymentMethod: "cash" | "card" | null;
  /** True when line prices already include VAT, false when VAT is added at the bottom (trade
   * receipts such as Costco), null when the receipt doesn't say. */
  pricesIncludeVat: boolean | null;
  lines: ReceiptLine[];
  /** The VAT table if the receipt prints one: net and VAT per rate. */
  vatSummary: { rate: number; net: number | null; vat: number | null }[];
  netTotal: number | null;
  vatTotal: number | null;
  grossTotal: number | null;
  category: string | null;
  notes: string | null;
};

export type BillLine = { description: string; qty: number; unitCost: number; vatRate: number };
export type BillExtraction = {
  kind: "bill";
  vendorName: string | null;
  billNumber: string | null;
  date: string | null;
  dueDate: string | null;
  lines: BillLine[];
};

export type TillExtraction = {
  kind: "till";
  total: number | null;
  denominations: Partial<Record<(typeof DENOMINATIONS)[number]["key"], number>> | null;
};

export type ListLine = { description: string; qty: number; unit: string | null };
export type ListExtraction = { kind: "list"; items: ListLine[] };

export type ScanExtraction = ReceiptExtraction | BillExtraction | TillExtraction | ListExtraction;

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
        payment_method: { type: "string", enum: ["cash", "card"], description: "How it was paid, if the receipt shows it." },
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
        category: { type: "string", enum: [...EXPENSE_CATEGORIES], description: "The single best category for the receipt overall." },
        notes: { type: "string", description: "A short one-line description of what was purchased, if useful." },
      },
      required: ["payee", "lines"],
    },
  },
  bill: {
    name: "record_bill",
    description: "Structured data read from a photo of a supplier invoice or bill, including its line items.",
    input_schema: {
      type: "object",
      properties: {
        vendor_name: { type: "string", description: "The supplier's business name." },
        bill_number: { type: "string", description: "The supplier's own invoice/bill number." },
        date: { type: "string", description: "Invoice date, as YYYY-MM-DD." },
        due_date: { type: "string", description: "Payment due date, as YYYY-MM-DD, if shown." },
        lines: {
          type: "array",
          description: "Each distinct product or service line on the bill.",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              qty: { type: "number", description: "Quantity. Default to 1 if not shown separately from the price." },
              unit_cost: { type: "number", description: "Cost per unit, excluding VAT." },
              vat_rate: { type: "number", enum: VAT_RATE_ENUM, description: "This line's UK VAT rate — 0, 5 or 20." },
            },
            required: ["description", "unit_cost"],
          },
        },
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
  const base = "You read UK retail and hospitality documents precisely. Only report figures you can actually see — never estimate or invent a value that isn't legible, and simply omit a field you can't read rather than guessing.";
  if (kind === "receipt")
    return `${base} You are reading a single shop receipt for a business purchase. Transcribe every item line (do not stop early on a long receipt), with its printed amount, quantity and VAT rate. Work out whether the printed line prices include VAT or exclude it (trade receipts often list prices before VAT, with 'TOTAL (EXCL VAT)', a VAT table and 'TOTAL (INCL VAT)' at the bottom — check that the line amounts add up to the ex-VAT total to be sure). Read the VAT table exactly as printed. A receipt that prints no VAT at all (many retail receipts) simply has no VAT information — leave those fields out rather than inventing them. Ignore barcodes, survey codes, loyalty messages and addresses when listing items.`;
  if (kind === "bill") return `${base} You are reading a supplier invoice or delivery note addressed to the business, listing what was bought and at what cost.`;
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
      max_tokens: 4096,
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

function str(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, 200) : null;
}
function isoDate(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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
      payee: str(input.payee),
      date: isoDate(input.date),
      paymentMethod: method === "cash" || method === "card" ? method : null,
      pricesIncludeVat: typeof input.prices_include_vat === "boolean" ? input.prices_include_vat : null,
      lines,
      vatSummary,
      netTotal: money(input.net_total),
      vatTotal: money(input.vat_total),
      grossTotal: money(input.gross_total),
      category: category(input.category),
      notes: str(input.notes),
    };
  }
  if (kind === "bill") {
    const rawLines = Array.isArray(input.lines) ? input.lines : [];
    const lines: BillLine[] = rawLines
      .map((l) => {
        if (typeof l !== "object" || l === null) return null;
        const rec = l as Record<string, unknown>;
        const unitCost = num(rec.unit_cost);
        const description = str(rec.description);
        if (!description || unitCost === null || unitCost < 0) return null;
        const qty = num(rec.qty);
        return { description, qty: qty && qty > 0 ? roundQty(qty) : 1, unitCost: roundMoney(unitCost), vatRate: vatRate(rec.vat_rate) };
      })
      .filter((l): l is BillLine => l !== null)
      .slice(0, 40);
    return { kind, vendorName: str(input.vendor_name), billNumber: str(input.bill_number), date: isoDate(input.date), dueDate: isoDate(input.due_date), lines };
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
