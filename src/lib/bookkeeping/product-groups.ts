import { createClient } from "@/lib/supabase/server";
import type { ProductGroup } from "./supplier-types";

/** The bookkeeper's own product groups for an org, by name. */
export async function getProductGroups(orgId: string): Promise<ProductGroup[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("product_groups").select("id, name, keywords").eq("org_id", orgId).order("name");
  return (data ?? []).map((g) => ({ id: g.id, name: g.name, keywords: g.keywords ?? [] }));
}
