"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import type { ActionResult } from "@/lib/bookkeeping/server-actions";

const OK: ActionResult = { error: null };

/* -------------------------------- VAT settings ---------------------------- */
// Bank, receivables, payables, expenses, payroll and POS actions live in their own files next to
// this one (bank-actions.ts, receivables-actions.ts, …) — see @/lib/bookkeeping/server-actions
// for what they share.

/** Organisation-level VAT settings. `addVatToTotal` is only the default for NEW invoices —
 * invoices that already exist keep whatever they were created with. */
export async function updateVatSettings(input: { addVatToTotal: boolean; vatNumber: string }): Promise<ActionResult> {
  const org = await getCurrentOrg();
  if (!org || (org.role !== "owner" && org.role !== "admin")) {
    return { error: "Only the owner or an admin can change VAT settings." };
  }
  const vatNumber = input.vatNumber.replace(/\s+/g, "").replace(/^GB/i, "");
  if (vatNumber && !/^\d{9}$/.test(vatNumber)) return { error: "A UK VAT number is 9 digits (optionally starting GB)." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ add_vat_to_total: !!input.addVatToTotal, vat_number: vatNumber || null })
    .eq("id", org.orgId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard", "layout");
  return OK;
}

/* ---------------------------- AI scan settings ----------------------------- */

/** Whether an AI photo scan saves itself once the photo gives everything a save needs, instead of
 * always waiting for a person to review the form and press Save. Off by default. */
export async function updateAutoSaveScans(input: { autoSaveScans: boolean }): Promise<ActionResult> {
  const org = await getCurrentOrg();
  if (!org || (org.role !== "owner" && org.role !== "admin")) {
    return { error: "Only the owner or an admin can change this." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({ auto_save_scans: !!input.autoSaveScans }).eq("id", org.orgId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard", "layout");
  return OK;
}

/* ----------------------------- Type of business ---------------------------- */

/** A property investment company's invoices carry the managed property, rent and tenancy details;
 * every other business keeps the standard invoice. */
export async function updateBusinessType(input: { businessType: "standard" | "property" }): Promise<ActionResult> {
  const org = await getCurrentOrg();
  if (!org || (org.role !== "owner" && org.role !== "admin")) {
    return { error: "Only the owner or an admin can change this." };
  }
  if (input.businessType !== "standard" && input.businessType !== "property") return { error: "Unknown business type." };
  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({ business_type: input.businessType }).eq("id", org.orgId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard", "layout");
  return OK;
}
