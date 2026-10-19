import { EXPENSE_CATEGORIES } from "@/lib/bookkeeping/categories";
import { DENOMINATIONS } from "@/lib/cashup";
import { roundMoney, roundQty } from "@/lib/format";

/** Reads structured data out of a photo — a receipt, a supplier bill, or a till/cash-register
 * total — using Claude's vision. Every field the model returns is treated as a suggestion: the
 * caller always pre-fills a normal editable form with it rather than saving anything directly, so
 * a misread number is a quick edit, not a wrong figure in the books. */

export type ScanKind = "receipt" | "bill" | "till" | "list";

export type ReceiptExtraction = {
  kind: "receipt";
  payee: string | null;
  date: string | null;
  gross: number | null;
  vatRate: number | null;
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
    description: "Structured data read from a photo of a single purchase or expense receipt.",
    input_schema: {
      type: "object",
      properties: {
        payee: { type: "string", description: "The business name printed on the receipt." },
        date: { type: "string", description: "Date of the transaction, as YYYY-MM-DD. Omit if not legible." },
        gross_amount: { type: "number", description: "The final total actually paid, including any VAT." },
        vat_rate: { type: "number", enum: VAT_RATE_ENUM, description: "The UK VAT rate this receipt implies — 0, 5 or 20. Best guess from the total/VAT shown." },
        category: { type: "string", enum: [...EXPENSE_CATEGORIES], description: "The best-matching expense category for what was bought." },
        notes: { type: "string", description: "A short one-line description of what was purchased, if useful." },
      },
      required: ["payee", "gross_amount"],
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
  if (kind === "receipt") return `${base} You are reading a single receipt for a business expense (fuel, supplies, a bill payment slip, etc.) — not a customer sales receipt.`;
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
      max_tokens: 1024,
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
    const gross = num(input.gross_amount);
    return {
      kind,
      payee: str(input.payee),
      date: isoDate(input.date),
      gross: gross !== null ? roundMoney(Math.abs(gross)) : null,
      vatRate: input.vat_rate !== undefined ? vatRate(input.vat_rate) : null,
      category: (EXPENSE_CATEGORIES as readonly string[]).includes(String(input.category)) ? String(input.category) : null,
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
