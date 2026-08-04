"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import type { ImportResult } from "@/lib/csv/parse";

export async function importItems(rows: Record<string, string>[]): Promise<ImportResult> {
  const org = await getCurrentOrg();
  if (!org) return { inserted: 0, skipped: rows.length, error: "You must be signed in to import." };

  const supabase = await createClient();
  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const name = row.name?.trim();
    if (!name) {
      skipped++;
      continue;
    }
    const { error } = await supabase.from("items").insert({
      org_id: org.orgId,
      item_code: row.item_code || null,
      name,
      description: row.description || null,
      category: row.category || null,
      sale_price: Number(row.sale_price) || 0,
      stock_qty: Number(row.stock_qty) || 0,
      unit: row.unit || "unit",
      vat_rate: row.vat_rate ? Number(row.vat_rate) || 20 : 20,
    });
    if (error) skipped++;
    else inserted++;
  }

  revalidatePath("/dashboard/items");
  return { inserted, skipped };
}
