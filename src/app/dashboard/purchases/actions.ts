"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { cleanPropertyDetails } from "@/lib/property";
import type { Json } from "@/lib/supabase/types";
import { groupForSupplierType, isSupplierType, normaliseGroup } from "@/lib/bookkeeping/supplier-types";
import { getProductGroups } from "@/lib/bookkeeping/product-groups";

export type PurchaseFormState = { error: string | null };

export type PurchaseLineItemInput = {
  item_id: string | null;
  description: string;
  qty: number;
  unit_cost: number;
  /** VAT % on this line; defaults to 0 (most food is zero-rated). */
  vat_rate?: number;
  /** Stock category (Fish & seafood, Fruit & veg…); empty means "whatever the supplier sells". */
  category?: string | null;
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
  const purchaseDate = String(formData.get("purchase_date") ?? "");
  const dueDate = String(formData.get("due_date") ?? "");

  let propertyDetails: Json | null = null;
  try {
    const raw = String(formData.get("property_details") ?? "");
    if (raw && org.businessType === "property") propertyDetails = cleanPropertyDetails(JSON.parse(raw)) as unknown as Json | null;
  } catch {
    propertyDetails = null;
  }

  const supabase = await createClient();

  // A supplier with no type yet takes the one the scan worked out; its type then fills in the
  // category on any line left on "From supplier".
  const { data: vendor } = await supabase.from("vendors").select("id, supplier_type").eq("id", vendorId).eq("org_id", org.orgId).maybeSingle();
  if (!vendor) return { error: "Select a vendor." };
  let supplierType = vendor.supplier_type;
  const scannedType = String(formData.get("supplier_type") ?? "");
  if (!supplierType && isSupplierType(scannedType)) {
    await supabase.from("vendors").update({ supplier_type: scannedType }).eq("id", vendor.id);
    supplierType = scannedType;
  }
  const supplierGroup = groupForSupplierType(supplierType);
  const groups = await getProductGroups(org.orgId);

  const { data: purchase, error } = await supabase
    .from("purchases")
    .insert({
      org_id: org.orgId,
      vendor_id: vendorId,
      notes: String(formData.get("notes") ?? "") || null,
      supplier_ref: supplierRef || null,
      // Left out when empty so the database default (today) applies.
      ...(/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) ? { purchase_date: purchaseDate } : {}),
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
      category: normaliseGroup(li.category, groups) ?? supplierGroup,
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
