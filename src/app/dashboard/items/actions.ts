"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";

export type ItemFormState = { error: string | null };

export async function createItem(
  _prevState: ItemFormState,
  formData: FormData
): Promise<ItemFormState> {
  const org = await getCurrentOrg();
  if (!org) redirect("/onboarding");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("items").insert({
    org_id: org.orgId,
    name,
    description: String(formData.get("description") ?? "") || null,
    category: String(formData.get("category") ?? "") || null,
    sale_price: Number(formData.get("sale_price") ?? 0) || 0,
    stock_qty: Number(formData.get("stock_qty") ?? 0) || 0,
    unit: String(formData.get("unit") ?? "unit") || "unit",
    vat_rate: Number(formData.get("vat_rate") ?? 20) || 0,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/items");
  redirect("/dashboard/items");
}

export async function updateItem(
  id: string,
  _prevState: ItemFormState,
  formData: FormData
): Promise<ItemFormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("items")
    .update({
      name,
      description: String(formData.get("description") ?? "") || null,
      category: String(formData.get("category") ?? "") || null,
      sale_price: Number(formData.get("sale_price") ?? 0) || 0,
      stock_qty: Number(formData.get("stock_qty") ?? 0) || 0,
      unit: String(formData.get("unit") ?? "unit") || "unit",
      vat_rate: Number(formData.get("vat_rate") ?? 20) || 0,
      is_active: formData.get("is_active") === "on",
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/items");
  redirect("/dashboard/items");
}

export async function deleteItem(id: string) {
  const supabase = await createClient();
  await supabase.from("items").delete().eq("id", id);
  revalidatePath("/dashboard/items");
  redirect("/dashboard/items");
}
