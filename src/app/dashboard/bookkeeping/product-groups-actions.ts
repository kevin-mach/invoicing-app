"use server";

import { revalidatePath } from "next/cache";
import { STOCK_GROUPS } from "@/lib/bookkeeping/categories";
import { bookkeepingCtx, NOT_ALLOWED, OK, refreshBookkeeping, type ActionResult } from "@/lib/bookkeeping/server-actions";

function clean(name: string, keywords: string) {
  const n = String(name ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  const words = [
    ...new Set(
      String(keywords ?? "")
        .split(",")
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean)
    ),
  ].slice(0, 40);
  return { name: n, keywords: words };
}

function refreshAll() {
  refreshBookkeeping();
  revalidatePath("/dashboard/purchases", "layout");
  revalidatePath("/dashboard/items", "layout");
}

/** Adds or edits one of the bookkeeper's own product groups. Keywords are comma-separated. */
export async function saveProductGroup(id: string | null, name: string, keywords: string): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  const g = clean(name, keywords);
  if (!g.name) return { error: "Give the group a name." };
  if (STOCK_GROUPS.some((s) => s.toLowerCase() === g.name.toLowerCase())) return { error: `"${g.name}" is already a built-in group.` };

  let oldName: string | null = null;
  if (id) {
    const { data } = await c.supabase.from("product_groups").select("name").eq("id", id).eq("org_id", c.org.orgId).maybeSingle();
    if (!data) return { error: "Group not found." };
    oldName = data.name;
  }
  const { error } = id
    ? await c.supabase.from("product_groups").update(g).eq("id", id).eq("org_id", c.org.orgId)
    : await c.supabase.from("product_groups").insert({ ...g, org_id: c.org.orgId });
  if (error) return { error: error.code === "23505" ? `There's already a group called "${g.name}".` : error.message };

  // A rename carries over to everything already in the group.
  if (oldName && oldName !== g.name) await renameEverywhere(c, oldName, g.name);
  refreshAll();
  return OK;
}

/** Deletes a group. Items and purchase lines in it go back to having no group of their own. */
export async function deleteProductGroup(id: string): Promise<ActionResult> {
  const c = await bookkeepingCtx();
  if (!c) return NOT_ALLOWED;
  const { data } = await c.supabase.from("product_groups").select("name").eq("id", id).eq("org_id", c.org.orgId).maybeSingle();
  if (!data) return { error: "Group not found." };
  const { error } = await c.supabase.from("product_groups").delete().eq("id", id);
  if (error) return { error: error.message };
  await renameEverywhere(c, data.name, null);
  refreshAll();
  return OK;
}

async function renameEverywhere(c: NonNullable<Awaited<ReturnType<typeof bookkeepingCtx>>>, from: string, to: string | null) {
  const { org, supabase } = c;
  await supabase.from("items").update({ category: to }).eq("org_id", org.orgId).eq("category", from);
  const { data: purchases } = await supabase.from("purchases").select("id").eq("org_id", org.orgId);
  const ids = (purchases ?? []).map((p) => p.id);
  for (let i = 0; i < ids.length; i += 200) {
    await supabase.from("purchase_line_items").update({ category: to }).in("purchase_id", ids.slice(i, i + 200)).eq("category", from);
  }
}
