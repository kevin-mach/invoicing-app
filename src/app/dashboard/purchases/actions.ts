"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";

export type PurchaseFormState = { error: string | null };

export type PurchaseLineItemInput = {
  item_id: string | null;
  description: string;
  qty: number;
  unit_cost: number;
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

  const supabase = await createClient();
  const { data: purchase, error } = await supabase
    .from("purchases")
    .insert({
      org_id: org.orgId,
      vendor_id: vendorId,
      notes: String(formData.get("notes") ?? "") || null,
    })
    .select("id")
    .single();

  if (error || !purchase) return { error: error?.message ?? "Could not create purchase." };

  const { error: liError } = await supabase.from("purchase_line_items").insert(
    lineItems.map((li) => ({
      purchase_id: purchase.id,
      item_id: li.item_id,
      description: li.description,
      qty: li.qty,
      unit_cost: li.unit_cost,
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
