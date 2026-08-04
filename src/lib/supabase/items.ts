import { createClient } from "@/lib/supabase/server";

export type ItemOption = {
  id: string;
  item_code: string | null;
  name: string;
  unit: string;
  sale_price: number;
  vat_rate: number;
  default_cost: number;
};

/** Items for an org, each annotated with its most recently paid cost across all vendors (0 if never purchased). */
export async function getItemsWithDefaultCost(orgId: string): Promise<ItemOption[]> {
  const supabase = await createClient();

  const [{ data: items }, { data: prices }] = await Promise.all([
    supabase
      .from("items")
      .select("id, item_code, name, unit, sale_price, vat_rate")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("vendor_item_prices")
      .select("item_id, cost_price, last_purchased_at")
      .eq("org_id", orgId),
  ]);

  const latestCostByItem = new Map<string, { cost: number; date: string }>();
  for (const p of prices ?? []) {
    const date = p.last_purchased_at ?? "";
    const existing = latestCostByItem.get(p.item_id);
    if (!existing || date > existing.date) {
      latestCostByItem.set(p.item_id, { cost: p.cost_price, date });
    }
  }

  return (items ?? []).map((item) => ({
    ...item,
    default_cost: latestCostByItem.get(item.id)?.cost ?? 0,
  }));
}
