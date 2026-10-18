import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { roundMoney } from "@/lib/format";
import { requireBookkeeper } from "./access";

/** Shared building blocks for the bookkeeping module's server actions (bank, receivables,
 * payables, expenses, payroll, POS…). Pulled out so every domain's "use server" file can reuse
 * the same guard, refresh and result shape instead of redefining them. */

export type ActionResult = { error: string | null };
export const OK: ActionResult = { error: null };
export const NOT_ALLOWED: ActionResult = { error: "Only the owner or bookkeeper can do that." };
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Revalidates every bookkeeping page. Cheap and safe to over-call — a single action rarely
 * knows every tab its change might be summarised on (Overview, P&L, VAT…). */
export function refreshBookkeeping() {
  revalidatePath("/dashboard/bookkeeping", "layout");
}

export type BookkeepingCtx = { org: NonNullable<Awaited<ReturnType<typeof requireBookkeeper>>>; supabase: Awaited<ReturnType<typeof createClient>> };

/** The standard entry guard for a bookkeeping action: null if the caller isn't the owner or
 * bookkeeper, otherwise their org plus a ready Supabase client. */
export async function bookkeepingCtx(): Promise<BookkeepingCtx | null> {
  const org = await requireBookkeeper();
  if (!org) return null;
  return { org, supabase: await createClient() };
}

/** Splits a VAT-inclusive amount into net + VAT for a given rate. */
export function splitGross(gross: number, vatRate: number): { net: number; vat: number } {
  const net = roundMoney(gross / (1 + vatRate / 100));
  return { net, vat: roundMoney(gross - net) };
}

/** Marks an invoice paid once payments cover it, or reopens it if they no longer do. */
export async function syncInvoiceStatus(supabase: BookkeepingCtx["supabase"], orgId: string, invoiceId: string) {
  const [{ data: invoice }, { data: payments }] = await Promise.all([
    supabase.from("invoices").select("total, status").eq("id", invoiceId).eq("org_id", orgId).maybeSingle(),
    supabase.from("invoice_payments").select("amount").eq("invoice_id", invoiceId),
  ]);
  if (!invoice) return;
  const paid = roundMoney((payments ?? []).reduce((s, p) => s + p.amount, 0));
  const covered = paid >= invoice.total - 0.005;
  if (covered && invoice.status !== "paid") {
    await supabase.from("invoices").update({ status: "paid" }).eq("id", invoiceId).eq("org_id", orgId);
  } else if (!covered && invoice.status === "paid") {
    await supabase.from("invoices").update({ status: "sent" }).eq("id", invoiceId).eq("org_id", orgId);
  }
}

/** Un-matches any bank line pointing at a given matched record (used when the record it points to
 * is deleted or unpaid, so the line goes back to Unreviewed instead of pointing at nothing). */
export async function unmatchBankLinesFor(supabase: BookkeepingCtx["supabase"], orgId: string, matchedType: string, matchedId: string) {
  await supabase
    .from("bank_transactions")
    .update({ status: "unreviewed", matched_type: null, matched_id: null, note: null })
    .eq("org_id", orgId)
    .eq("matched_type", matchedType)
    .eq("matched_id", matchedId);
}
