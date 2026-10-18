"use server";

import { revalidatePath } from "next/cache";
import type { PosDay } from "@/lib/bookkeeping/pos";
import { bookkeepingCtx, ISO_DATE, NOT_ALLOWED, OK, refreshBookkeeping, type ActionResult } from "@/lib/bookkeeping/server-actions";
import { roundMoney } from "@/lib/format";

export async function importPosDays(days: PosDay[]): Promise<ActionResult & { saved?: number }> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  if (!days.length) return { error: "Nothing to import." };
  if (days.length > 1000) return { error: "Import at most 1,000 days at a time." };
  const rows = [];
  for (const d of days) {
    if (!ISO_DATE.test(d.sales_date)) continue;
    rows.push({
      org_id: c.org.orgId,
      source: "csv",
      sales_date: d.sales_date,
      location: (d.location || "Main").slice(0, 80),
      gross_sales: roundMoney(d.gross_sales),
      net_sales: roundMoney(d.net_sales),
      vat_amount: roundMoney(d.vat_amount),
      cash_total: roundMoney(d.cash_total),
      card_total: roundMoney(d.card_total),
      other_total: roundMoney(d.other_total),
      tips: roundMoney(d.tips),
      refunds: roundMoney(d.refunds),
      discounts: roundMoney(d.discounts),
      service_charge: roundMoney(d.service_charge),
      transactions: Math.max(0, Math.round(d.transactions)),
      updated_at: new Date().toISOString(),
    });
  }
  if (!rows.length) return { error: "No valid rows to import." };
  const { error } = await c.supabase.from("pos_daily_sales").upsert(rows, { onConflict: "org_id,source,location,sales_date" });
  if (error) return { error: error.message };
  refreshBookkeeping();
  revalidatePath("/dashboard/cash-up");
  return { error: null, saved: rows.length };
}

export async function deletePosDay(id: string): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  const { error } = await c.supabase.from("pos_daily_sales").delete().eq("id", id).eq("org_id", c.org.orgId);
  if (error) return { error: error.message };
  refreshBookkeeping();
  return OK;
}
