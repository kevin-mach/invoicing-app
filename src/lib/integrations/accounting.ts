import { createAdminClient } from "@/lib/supabase/admin";
import { roundMoney } from "@/lib/format";
import { providerConfig } from "./config";
import { apiFetch, getAccessToken, logSync } from "./store";

export type AccountingProvider = "xero" | "quickbooks";
export const PUSH_CAP = 25;

export type PushDoc = {
  kind: "invoice" | "bill";
  id: string;
  number: string;
  party: string;
  date: string;
  due: string | null;
  net: number;
  vat: number;
  lines: { description: string; qty: number; unit: number; rate: number }[];
  /** Why this can't be pushed, if it can't. */
  blocked?: string;
};

export type PushPlan = { ready: PushDoc[]; blocked: PushDoc[]; remaining: number };

const XERO_TAX = { sales: { 20: "OUTPUT2", 5: "RROUTPUT", 0: "ZERORATEDOUTPUT" }, purchase: { 20: "INPUT2", 5: "RRINPUT", 0: "ZERORATEDINPUT" } } as const;

function rateBlocked(lines: PushDoc["lines"]): string | undefined {
  const bad = lines.find((l) => ![0, 5, 20].includes(Number(l.rate)));
  return bad ? `Uses a ${bad.rate}% VAT rate, which can't be mapped to a UK tax type.` : undefined;
}

/** Everything not yet sent to this provider, split into what can go and what can't (with the
 * reason). Invoices whose VAT isn't added to their total are held back: sending them with VAT
 * would make the accounting system's total differ from the invoice the customer actually got. */
export async function planPush(orgId: string, provider: AccountingProvider): Promise<PushPlan> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);

  const [{ data: refs }, { data: invoices }, { data: purchases }] = await Promise.all([
    admin.from("external_refs").select("entity_type, entity_id").eq("org_id", orgId).eq("provider", provider),
    admin
      .from("invoices")
      .select("id, number, issue_date, due_date, status, vat_on_top, customers(name), invoice_line_items(description, qty, unit_price, vat_rate)")
      .eq("org_id", orgId)
      .in("status", ["sent", "overdue", "paid"])
      .gte("issue_date", since)
      .order("issue_date")
      .limit(500),
    admin
      .from("purchases")
      .select("id, supplier_ref, purchase_date, due_date, vendors(name), purchase_line_items(description, qty, unit_cost, vat_rate)")
      .eq("org_id", orgId)
      .gte("purchase_date", since)
      .order("purchase_date")
      .limit(500),
  ]);
  const done = new Set((refs ?? []).map((r) => `${r.entity_type}:${r.entity_id}`));
  const docs: PushDoc[] = [];

  for (const i of invoices ?? []) {
    if (done.has(`invoice:${i.id}`)) continue;
    const lines = (i.invoice_line_items ?? []).map((l) => ({ description: l.description, qty: Number(l.qty), unit: Number(l.unit_price), rate: Number(l.vat_rate) }));
    const net = roundMoney(lines.reduce((s, l) => s + l.qty * l.unit, 0));
    const vat = roundMoney(lines.reduce((s, l) => s + (l.qty * l.unit * l.rate) / 100, 0));
    let blocked: string | undefined;
    if (!lines.length) blocked = "Has no lines.";
    else if (vat > 0 && !i.vat_on_top) blocked = "VAT isn't added to this invoice's total, so sending it would change the amount. Tick 'Add VAT to the total' on the invoice first, or record it manually.";
    else blocked = rateBlocked(lines);
    docs.push({ kind: "invoice", id: i.id, number: i.number ?? i.id.slice(0, 8), party: i.customers?.name ?? "Customer", date: i.issue_date, due: i.due_date, net, vat, lines, blocked });
  }
  for (const p of purchases ?? []) {
    if (done.has(`bill:${p.id}`)) continue;
    const lines = (p.purchase_line_items ?? []).map((l) => ({ description: l.description, qty: Number(l.qty), unit: Number(l.unit_cost), rate: Number(l.vat_rate) }));
    const net = roundMoney(lines.reduce((s, l) => s + l.qty * l.unit, 0));
    const vat = roundMoney(lines.reduce((s, l) => s + (l.qty * l.unit * l.rate) / 100, 0));
    const blocked = !lines.length ? "Has no lines." : rateBlocked(lines);
    docs.push({ kind: "bill", id: p.id, number: p.supplier_ref || `PUR-${p.id.slice(0, 8)}`, party: p.vendors?.name ?? "Supplier", date: p.purchase_date, due: p.due_date, net, vat, lines, blocked });
  }
  const ready = docs.filter((d) => !d.blocked);
  return { ready: ready.slice(0, PUSH_CAP), blocked: docs.filter((d) => d.blocked), remaining: Math.max(0, ready.length - PUSH_CAP) };
}

/* ---------------------------------- Xero ---------------------------------- */

async function pushXero(orgId: string, doc: PushDoc, token: string, tenant: string, settings: Record<string, string>) {
  const cfg = providerConfig("xero");
  const table = doc.kind === "invoice" ? XERO_TAX.sales : XERO_TAX.purchase;
  const account = doc.kind === "invoice" ? settings.xeroSalesAccount || "200" : settings.xeroPurchaseAccount || "310";
  const body = {
    Type: doc.kind === "invoice" ? "ACCREC" : "ACCPAY",
    Contact: { Name: doc.party },
    Date: doc.date,
    DueDate: doc.due ?? doc.date,
    InvoiceNumber: doc.number,
    LineAmountTypes: "Exclusive",
    Status: "AUTHORISED",
    LineItems: doc.lines.map((l) => ({
      Description: l.description.slice(0, 4000),
      Quantity: l.qty,
      UnitAmount: l.unit,
      AccountCode: account,
      TaxType: table[l.rate as 0 | 5 | 20],
    })),
  };
  const res = (await apiFetch(`${cfg.apiUrl}/api.xro/2.0/Invoices`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xero-tenant-id": tenant, "Idempotency-Key": `${orgId}:${doc.kind}:${doc.id}`.slice(0, 128) },
    body: JSON.stringify({ Invoices: [body] }),
  })) as { Invoices?: { InvoiceID?: string; InvoiceNumber?: string }[] };
  const created = res.Invoices?.[0];
  if (!created?.InvoiceID) throw new Error("Xero didn't confirm the document.");
  return { id: created.InvoiceID, number: created.InvoiceNumber ?? doc.number };
}

/* ------------------------------- QuickBooks ------------------------------- */

type Qb = (path: string, init?: { method?: string; body?: unknown }) => Promise<Record<string, unknown>>;

function qboClient(apiUrl: string, realm: string, token: string): Qb {
  return (path, init) =>
    apiFetch(`${apiUrl}/v3/company/${realm}${path}${path.includes("?") ? "&" : "?"}minorversion=75`, token, {
      method: init?.method ?? "GET",
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
    }) as Promise<Record<string, unknown>>;
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

async function qboQuery<T>(qb: Qb, sql: string, entity: string): Promise<T[]> {
  const r = (await qb(`/query?query=${encodeURIComponent(sql)}`)) as { QueryResponse?: Record<string, T[]> };
  return r.QueryResponse?.[entity] ?? [];
}

/** Finds the QuickBooks tax code for a UK rate by name ("20.0% S", "5.0% R", "0.0% Z"), since
 * ids differ per company. */
async function qboTaxCodes(qb: Qb): Promise<Record<number, string>> {
  const codes = await qboQuery<{ Id: string; Name: string; Active?: boolean }>(qb, "select * from TaxCode", "TaxCode");
  const pick = (re: RegExp) => codes.find((c) => c.Active !== false && re.test(c.Name))?.Id;
  const out: Record<number, string> = {};
  const r20 = pick(/^20(\.0)?%\s*S/i);
  const r5 = pick(/^5(\.0)?%\s*R/i);
  const r0 = pick(/^0(\.0)?%\s*Z/i);
  if (r20) out[20] = r20;
  if (r5) out[5] = r5;
  if (r0) out[0] = r0;
  return out;
}

async function pushQbo(qb: Qb, doc: PushDoc, ctx: { tax: Record<number, string>; itemId?: string; expenseAccountId?: string }) {
  for (const l of doc.lines) {
    if (!ctx.tax[l.rate]) throw new Error(`No QuickBooks tax code found for ${l.rate}% VAT.`);
  }
  if (doc.kind === "invoice") {
    let customer = (await qboQuery<{ Id: string }>(qb, `select Id from Customer where DisplayName = '${esc(doc.party)}'`, "Customer"))[0];
    if (!customer) customer = ((await qb("/customer", { method: "POST", body: { DisplayName: doc.party } })) as { Customer: { Id: string } }).Customer;
    if (!ctx.itemId) throw new Error("No QuickBooks sales item found — create an item called 'Sales' (or 'Services').");
    const res = (await qb("/invoice", {
      method: "POST",
      body: {
        DocNumber: doc.number.slice(0, 21),
        TxnDate: doc.date,
        DueDate: doc.due ?? doc.date,
        CustomerRef: { value: customer.Id },
        GlobalTaxCalculation: "TaxExcluded",
        Line: doc.lines.map((l) => ({
          Amount: roundMoney(l.qty * l.unit),
          Description: l.description.slice(0, 4000),
          DetailType: "SalesItemLineDetail",
          SalesItemLineDetail: { ItemRef: { value: ctx.itemId }, Qty: l.qty, UnitPrice: l.unit, TaxCodeRef: { value: ctx.tax[l.rate] } },
        })),
      },
    })) as { Invoice?: { Id: string; DocNumber?: string } };
    if (!res.Invoice?.Id) throw new Error("QuickBooks didn't confirm the invoice.");
    return { id: res.Invoice.Id, number: res.Invoice.DocNumber ?? doc.number };
  }
  let vendor = (await qboQuery<{ Id: string }>(qb, `select Id from Vendor where DisplayName = '${esc(doc.party)}'`, "Vendor"))[0];
  if (!vendor) vendor = ((await qb("/vendor", { method: "POST", body: { DisplayName: doc.party } })) as { Vendor: { Id: string } }).Vendor;
  if (!ctx.expenseAccountId) throw new Error("No QuickBooks cost-of-sales account found.");
  const res = (await qb("/bill", {
    method: "POST",
    body: {
      DocNumber: doc.number.slice(0, 21),
      TxnDate: doc.date,
      DueDate: doc.due ?? doc.date,
      VendorRef: { value: vendor.Id },
      GlobalTaxCalculation: "TaxExcluded",
      Line: doc.lines.map((l) => ({
        Amount: roundMoney(l.qty * l.unit),
        Description: l.description.slice(0, 4000),
        DetailType: "AccountBasedExpenseLineDetail",
        AccountBasedExpenseLineDetail: { AccountRef: { value: ctx.expenseAccountId }, TaxCodeRef: { value: ctx.tax[l.rate] } },
      })),
    },
  })) as { Bill?: { Id: string } };
  if (!res.Bill?.Id) throw new Error("QuickBooks didn't confirm the bill.");
  return { id: res.Bill.Id, number: doc.number };
}

/* ---------------------------------- Runner -------------------------------- */

export type PushResult = { pushed: number; failed: { number: string; reason: string }[] };

/** Sends the (capped) ready set. Each document is recorded in external_refs the moment it succeeds,
 * so a partial failure never leads to duplicates on the next run. */
export async function runPush(orgId: string, provider: AccountingProvider): Promise<PushResult> {
  const admin = createAdminClient();
  const result: PushResult = { pushed: 0, failed: [] };
  try {
    const plan = await planPush(orgId, provider);
    if (!plan.ready.length) {
      await logSync(orgId, provider, "push", "ok", 0, "Nothing to send");
      return result;
    }
    const { token, connection } = await getAccessToken(orgId, provider);
    const cfg = providerConfig(provider);
    const settings = (connection.settings ?? {}) as Record<string, string>;
    if (!connection.account_id) throw new Error("No organisation is linked — reconnect.");

    let qb: Qb | undefined;
    let qctx: { tax: Record<number, string>; itemId?: string; expenseAccountId?: string } | undefined;
    if (provider === "quickbooks") {
      qb = qboClient(cfg.apiUrl, connection.account_id, token);
      const items = await qboQuery<{ Id: string; Name: string }>(qb, "select Id, Name from Item where Type in ('Service','NonInventory') maxresults 100", "Item");
      const accounts = await qboQuery<{ Id: string }>(qb, "select Id from Account where AccountType = 'Cost of Goods Sold' maxresults 1", "Account");
      qctx = {
        tax: await qboTaxCodes(qb),
        itemId: (items.find((i) => /^(sales|services)$/i.test(i.Name)) ?? items[0])?.Id,
        expenseAccountId: accounts[0]?.Id,
      };
    }

    for (const doc of plan.ready) {
      try {
        const out = provider === "xero" ? await pushXero(orgId, doc, token, connection.account_id, settings) : await pushQbo(qb!, doc, qctx!);
        await admin.from("external_refs").insert({ org_id: orgId, provider, entity_type: doc.kind, entity_id: doc.id, external_id: out.id, external_number: out.number });
        result.pushed++;
      } catch (e) {
        result.failed.push({ number: doc.number, reason: e instanceof Error ? e.message : "Failed" });
      }
    }
    const status = result.failed.length && !result.pushed ? "error" : "ok";
    await logSync(orgId, provider, "push", status, result.pushed, result.failed.length ? `${result.failed.length} failed, e.g. ${result.failed[0].number}: ${result.failed[0].reason}` : `${result.pushed} sent`);
    return result;
  } catch (e) {
    await logSync(orgId, provider, "push", "error", 0, e instanceof Error ? e.message : "Push failed.");
    throw e;
  }
}
