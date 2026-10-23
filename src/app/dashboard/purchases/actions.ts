"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { cleanPropertyDetails } from "@/lib/property";
import type { Json } from "@/lib/supabase/types";

export type PurchaseFormState = { error: string | null };

export type PurchaseLineItemInput = {
  item_id: string | null;
  description: string;
  qty: number;
  unit_cost: number;
  /** VAT % on this line; defaults to 0 (most food is zero-rated). */
  vat_rate?: number;
};

function parseLineItems(raw: string): PurchaseLineItemInput[] {
  try {
    const parsed = JSON.parse(raw) as PurchaseLineItemInput[];
    return parsed.filter((li) => li.description.trim().length > 0);
  } catch {
    return [];
  }
}

export async function createPurchase(
  _prevState: PurchaseFormState,
  formData: FormData
): Promise<PurchaseFormState> {
  const org = await getCurrentOrg();
  if (!org) redirect("/onboarding");

  const vendorId = String(formData.get("vendor_id") ?? "");
  if (!vendorId) return { error: "Select a vendor." };

  const lineItems = parseLineItems(String(formData.get("line_items") ?? "[]"));
  if (!lineItems.length) return { error: "Add at least one line item." };

  const supplierRef = String(formData.get("supplier_ref") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "");

  let propertyDetails: Json | null = null;
  try {
    const raw = String(formData.get("property_details") ?? "");
    if (raw && org.businessType === "property") propertyDetails = cleanPropertyDetails(JSON.parse(raw)) as unknown as Json | null;
  } catch {
    propertyDetails = null;
  }

  const supabase = await createClient();
  const { data: purchase, error } = await supabase
    .from("purchases")
    .insert({
      org_id: org.orgId,
      vendor_id: vendorId,
      notes: String(formData.get("notes") ?? "") || null,
      supplier_ref: supplierRef || null,
      due_date: /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null,
      property_details: propertyDetails,
    })
    .select("id")
    .single();

  if (error?.code === "23505") {
    return { error: "That supplier invoice number is already recorded for this supplier — possible duplicate." };
  }
  if (error || !purchase) return { error: error?.message ?? "Could not create purchase." };

  const { error: liError } = await supabase.from("purchase_line_items").insert(
    lineItems.map((li) => ({
      purchase_id: purchase.id,
      item_id: li.item_id,
      description: li.description,
      qty: li.qty,
      unit_cost: li.unit_cost,
      vat_rate: Math.min(100, Math.max(0, Number(li.vat_rate) || 0)),
    }))
  );

  if (liError) return { error: liError.message };

  const imageUrl = String(formData.get("image_url") ?? "");
  if (imageUrl) {
    await supabase.from("receipt_scans").insert({
      org_id: org.orgId,
      purchase_id: purchase.id,
      image_url: imageUrl,
      status: "committed",
    });
  }

  revalidatePath("/dashboard/purchases");
  redirect(`/dashboard/purchases/${purchase.id}`);
}

export async function updatePurchaseStatus(purchaseId: string, status: string) {
  const supabase = await createClient();
  await supabase.from("purchases").update({ status }).eq("id", purchaseId);
  revalidatePath(`/dashboard/purchases/${purchaseId}`);
  revalidatePath("/dashboard/purchases");
}

export async function deletePurchase(id: string) {
  const supabase = await createClient();
  await supabase.from("purchases").delete().eq("id", id);
  revalidatePath("/dashboard/purchases");
  redirect("/dashboard/purchases");
}
