"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import type { ImportResult } from "@/lib/csv/parse";

export async function importCustomers(rows: Record<string, string>[]): Promise<ImportResult> {
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
    const { error } = await supabase.from("customers").insert({
      org_id: org.orgId,
      name,
      email: row.email || null,
      phone: row.phone || null,
      address: row.address || null,
      notes: row.notes || null,
    });
    if (error) skipped++;
    else inserted++;
  }

  revalidatePath("/dashboard/customers");
  return { inserted, skipped };
}
