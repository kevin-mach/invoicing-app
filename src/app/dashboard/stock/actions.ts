"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { getItemsWithDefaultCost } from "@/lib/supabase/items";
import { WASTE_REASONS } from "@/lib/stock";
import { roundMoney, roundQty } from "@/lib/format";

export type StockResult = { error: string | null };
const OK: StockResult = { error: null };
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function refresh() {
  revalidatePath("/dashboard/stock");
  revalidatePath("/dashboard/bookkeeping", "layout");
}

export async function logWastage(input: {
  itemId: string;
  qty: number;
  reason: string;
  loggedOn: string;
  notes: string;
}): Promise<StockResult> {
  const org = await getCurrentOrg();
  if (!org) return { error: "You must be signed in." };

  const qty = roundQty(Number(input.qty));
  if (!Number.isFinite(qty) || qty <= 0) return { error: "Enter how much was wasted." };
  if (!(WASTE_REASONS as readonly { key: string }[]).some((r) => r.key === input.reason)) {
    return { error: "Pick a reason." };
  }
  if (!ISO_DATE.test(input.loggedOn)) return { error: "Enter the date." };

  const supabase = await createClient();
  const [items, { data: item }] = await Promise.all([
    getItemsWithDefaultCost(org.orgId),
    supabase.from("items").select("id, name, unit, stock_qty").eq("id", input.itemId).eq("org_id", org.orgId).maybeSingle(),
  ]);
  if (!item) return { error: "Item not found." };
  const unitCost = items.find((i) => i.id === item.id)?.default_cost ?? 0;

  const { error } = await supabase.from("wastage_logs").insert({
    org_id: org.orgId,
    item_id: item.id,
    item_name: item.name,
    unit: item.unit,
    qty,
    unit_cost: unitCost,
    reason: input.reason,
    logged_on: input.loggedOn,
    notes: input.notes.trim().slice(0, 300) || null,
    logged_by: org.userId,
  });
  if (error) return { error: error.message };

  // Wasted stock is gone: draw the on-hand level down (never below zero).
  await supabase
    .from("items")
    .update({ stock_qty: Math.max(0, roundQty(item.stock_qty - qty)) })
    .eq("id", item.id)
    .eq("org_id", org.orgId);

  refresh();
  return OK;
}

export async function deleteWastage(id: string): Promise<StockResult> {
  const org = await getCurrentOrg();
  if (!org) return { error: "You must be signed in." };
  const supabase = await createClient();

  const { data: log } = await supabase
    .from("wastage_logs")
    .select("id, item_id, qty")
    .eq("id", id)
    .eq("org_id", org.orgId)
    .maybeSingle();
  if (!log) return { error: "Entry not found." };

  await supabase.from("wastage_logs").delete().eq("id", log.id);
  if (log.item_id) {
    const { data: item } = await supabase.from("items").select("stock_qty").eq("id", log.item_id).maybeSingle();
    if (item) {
      await supabase
        .from("items")
        .update({ stock_qty: roundQty(item.stock_qty + log.qty) })
        .eq("id", log.item_id)
        .eq("org_id", org.orgId);
    }
  }
  refresh();
  return OK;
}

export async function saveStockCount(input: {
  countedOn: string;
  notes: string;
  lines: { itemId: string; countedQty: number }[];
  apply: boolean;
}): Promise<StockResult & { countId?: string }> {
  const org = await getCurrentOrg();
  if (!org) return { error: "You must be signed in." };
  if (!ISO_DATE.test(input.countedOn)) return { error: "Enter the date." };
  const lines = (input.lines ?? []).filter((l) => Number.isFinite(Number(l.countedQty)) && Number(l.countedQty) >= 0);
  if (!lines.length) return { error: "Enter at least one counted quantity." };

  const supabase = await createClient();
  const [costs, { data: items }] = await Promise.all([
    getItemsWithDefaultCost(org.orgId),
    supabase.from("items").select("id, name, unit, stock_qty").eq("org_id", org.orgId),
  ]);
  const itemById = new Map((items ?? []).map((i) => [i.id, i]));
  const costById = new Map(costs.map((c) => [c.id, c.default_cost]));

  const { data: count, error } = await supabase
    .from("stock_counts")
    .insert({
      org_id: org.orgId,
      counted_on: input.countedOn,
      notes: input.notes.trim().slice(0, 300) || null,
      applied: false,
      created_by: org.userId,
    })
    .select("id")
    .single();
  if (error || !count) return { error: error?.message ?? "Could not save the count." };

  const rows = lines.flatMap((l) => {
    const item = itemById.get(l.itemId);
    if (!item) return [];
    return [
      {
        count_id: count.id,
        item_id: item.id,
        item_name: item.name,
        unit: item.unit,
        system_qty: item.stock_qty,
        counted_qty: roundQty(Number(l.countedQty)),
        unit_cost: roundMoney(costById.get(item.id) ?? 0),
      },
    ];
  });
  const { error: lineError } = await supabase.from("stock_count_lines").insert(rows);
  if (lineError) {
    await supabase.from("stock_counts").delete().eq("id", count.id);
    return { error: lineError.message };
  }

  if (input.apply) await applyLines(supabase, org.orgId, count.id, rows);
  refresh();
  return { error: null, countId: count.id };
}

async function applyLines(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  countId: string,
  rows: { item_id: string | null; counted_qty: number }[]
) {
  for (const r of rows) {
    if (!r.item_id) continue;
    await supabase.from("items").update({ stock_qty: r.counted_qty }).eq("id", r.item_id).eq("org_id", orgId);
  }
  await supabase.from("stock_counts").update({ applied: true }).eq("id", countId).eq("org_id", orgId);
}

/** Sets each counted item's on-hand quantity to what was counted. */
export async function applyStockCount(countId: string): Promise<StockResult> {
  const org = await getCurrentOrg();
  if (!org) return { error: "You must be signed in." };
  const supabase = await createClient();

  const { data: count } = await supabase
    .from("stock_counts")
    .select("id, applied")
    .eq("id", countId)
    .eq("org_id", org.orgId)
    .maybeSingle();
  if (!count) return { error: "Count not found." };
  if (count.applied) return { error: "That count has already been applied." };

  const { data: lines } = await supabase.from("stock_count_lines").select("item_id, counted_qty").eq("count_id", countId);
  await applyLines(supabase, org.orgId, countId, lines ?? []);
  refresh();
  return OK;
}

export async function deleteStockCount(countId: string): Promise<StockResult> {
  const org = await getCurrentOrg();
  if (!org) return { error: "You must be signed in." };
  if (org.role === "staff") return { error: "Ask a manager to delete a stock count." };
  const supabase = await createClient();
  const { error } = await supabase.from("stock_counts").delete().eq("id", countId).eq("org_id", org.orgId);
  if (error) return { error: error.message };
  refresh();
  return OK;
}
