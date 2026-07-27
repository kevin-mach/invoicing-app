"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";

export type VendorFormState = { error: string | null };

export async function createVendor(
  _prevState: VendorFormState,
  formData: FormData
): Promise<VendorFormState> {
  const org = await getCurrentOrg();
  if (!org) redirect("/onboarding");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("vendors").insert({
    org_id: org.orgId,
    name,
    contact: String(formData.get("contact") ?? "") || null,
    address: String(formData.get("address") ?? "") || null,
    notes: String(formData.get("notes") ?? "") || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/vendors");
  redirect("/dashboard/vendors");
}

export async function updateVendor(
  id: string,
  _prevState: VendorFormState,
  formData: FormData
): Promise<VendorFormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("vendors")
    .update({
      name,
      contact: String(formData.get("contact") ?? "") || null,
      address: String(formData.get("address") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/vendors");
  redirect("/dashboard/vendors");
}

export async function deleteVendor(id: string) {
  const supabase = await createClient();
  await supabase.from("vendors").delete().eq("id", id);
  revalidatePath("/dashboard/vendors");
  redirect("/dashboard/vendors");
}
