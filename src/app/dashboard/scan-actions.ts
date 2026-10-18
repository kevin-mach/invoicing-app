"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import type { ItemOption } from "@/lib/supabase/items";

export type NewItemInput = { name: string; unit: string; vatRate?: number; salePrice?: number };
export type NamedRecord = { id: string; name: string };

export type ScannedEntriesResult = {
  error: string | null;
  suppliers: NamedRecord[];
  customers: NamedRecord[];
  items: ItemOption[];
};

const clean = (s: string, max = 120) => s.trim().replace(/\s+/g, " ").slice(0, max);
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Creates the suppliers, customers and catalogue items a person has just confirmed they want added
 * from a scan. Never called without that confirmation. A name that already exists is reused rather
 * than duplicated, so a double-tap can't create two copies. */
export async function createScannedEntries(input: {
  supplierNames?: string[];
  customerNames?: string[];
  items?: NewItemInput[];
}): Promise<ScannedEntriesResult> {
  const empty: ScannedEntriesResult = { error: null, suppliers: [], customers: [], items: [] };
  const org = await getCurrentOrg();
  if (!org) return { ...empty, error: "You must be signed in." };
  if (org.role === "bookkeeper") return { ...empty, error: "Ask the owner or a manager to add new suppliers and items." };

  const supabase = await createClient();
  const result = { ...empty };

  const supplierNames = [...new Set((input.supplierNames ?? []).map((n) => clean(n)).filter(Boolean))].slice(0, 10);
  if (supplierNames.length) {
    const { data: existing } = await supabase.from("vendors").select("id, name").eq("org_id", org.orgId);
    for (const name of supplierNames) {
      const found = (existing ?? []).find((v) => same(v.name, name));
      if (found) {
        result.suppliers.push(found);
        continue;
      }
      const { data, error } = await supabase.from("vendors").insert({ org_id: org.orgId, name }).select("id, name").single();
      if (error || !data) return { ...result, error: error?.message ?? `Couldn't add supplier "${name}".` };
      result.suppliers.push(data);
    }
  }

  const customerNames = [...new Set((input.customerNames ?? []).map((n) => clean(n)).filter(Boolean))].slice(0, 10);
  if (customerNames.length) {
    const { data: existing } = await supabase.from("customers").select("id, name").eq("org_id", org.orgId);
    for (const name of customerNames) {
      const found = (existing ?? []).find((c) => same(c.name, name));
      if (found) {
        result.customers.push(found);
        continue;
      }
      const { data, error } = await supabase.from("customers").insert({ org_id: org.orgId, name }).select("id, name").single();
      if (error || !data) return { ...result, error: error?.message ?? `Couldn't add customer "${name}".` };
      result.customers.push(data);
    }
  }

  const wanted = (input.items ?? []).filter((i) => clean(i.name)).slice(0, 100);
  if (wanted.length) {
    const { data: existing } = await supabase
      .from("items")
      .select("id, item_code, name, unit, sale_price, vat_rate")
      .eq("org_id", org.orgId)
      .eq("is_active", true);
    const seen = new Set<string>();
    for (const w of wanted) {
      const name = clean(w.name);
      if (seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      const found = (existing ?? []).find((i) => same(i.name, name));
      if (found) {
        result.items.push({ ...found, default_cost: 0 });
        continue;
      }
      const { data, error } = await supabase
        .from("items")
        .insert({
          org_id: org.orgId,
          name,
          unit: clean(w.unit, 20) || "unit",
          sale_price: Math.max(0, Number(w.salePrice) || 0),
          vat_rate: [0, 5, 20].includes(Number(w.vatRate)) ? Number(w.vatRate) : 20,
          stock_qty: 0,
        })
        .select("id, item_code, name, unit, sale_price, vat_rate")
        .single();
      if (error || !data) return { ...result, error: error?.message ?? `Couldn't add item "${name}".` };
      result.items.push({ ...data, default_cost: 0 });
    }
  }

  revalidatePath("/dashboard/items");
  revalidatePath("/dashboard/vendors");
  revalidatePath("/dashboard/customers");
  return result;
}
