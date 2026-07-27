"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";

export type TemplateFormState = { error: string | null };

export type TemplateLineItemInput = {
  item_id: string | null;
  description: string;
  qty: number;
  unit_cost: number;
  unit_price: number;
};

function parseLineItems(raw: string): TemplateLineItemInput[] {
  try {
    return (JSON.parse(raw) as TemplateLineItemInput[]).filter((li) => li.description.trim());
  } catch {
    return [];
  }
}

export async function createTemplate(
  _prevState: TemplateFormState,
  formData: FormData
): Promise<TemplateFormState> {
  const org = await getCurrentOrg();
  if (!org) redirect("/onboarding");

  const customerId = String(formData.get("customer_id") ?? "");
  const nextRunDate = String(formData.get("next_run_date") ?? "");
  if (!customerId) return { error: "Select a customer." };
  if (!nextRunDate) return { error: "Set the first run date." };

  const lineItems = parseLineItems(String(formData.get("line_items") ?? "[]"));
  if (!lineItems.length) return { error: "Add at least one line item." };

  const supabase = await createClient();
  const { data: template, error } = await supabase
    .from("recurring_invoice_templates")
    .insert({
      org_id: org.orgId,
      customer_id: customerId,
      cadence: String(formData.get("cadence") ?? "monthly"),
      next_run_date: nextRunDate,
    })
    .select("id")
    .single();

  if (error || !template) return { error: error?.message ?? "Could not create template." };

  const { error: liError } = await supabase.from("recurring_invoice_template_items").insert(
    lineItems.map((li, idx) => ({
      template_id: template.id,
      item_id: li.item_id,
      description: li.description,
      qty: li.qty,
      unit_cost: li.unit_cost,
      unit_price: li.unit_price,
      sort_order: idx,
    }))
  );

  if (liError) return { error: liError.message };

  revalidatePath("/dashboard/templates");
  redirect(`/dashboard/templates/${template.id}`);
}

export async function updateTemplate(
  templateId: string,
  _prevState: TemplateFormState,
  formData: FormData
): Promise<TemplateFormState> {
  const customerId = String(formData.get("customer_id") ?? "");
  const nextRunDate = String(formData.get("next_run_date") ?? "");
  if (!customerId) return { error: "Select a customer." };
  if (!nextRunDate) return { error: "Set the next run date." };

  const lineItems = parseLineItems(String(formData.get("line_items") ?? "[]"));
  if (!lineItems.length) return { error: "Add at least one line item." };

  const supabase = await createClient();
  const { error: tError } = await supabase
    .from("recurring_invoice_templates")
    .update({
      customer_id: customerId,
      cadence: String(formData.get("cadence") ?? "monthly"),
      next_run_date: nextRunDate,
    })
    .eq("id", templateId);

  if (tError) return { error: tError.message };

  await supabase.from("recurring_invoice_template_items").delete().eq("template_id", templateId);

  const { error: liError } = await supabase.from("recurring_invoice_template_items").insert(
    lineItems.map((li, idx) => ({
      template_id: templateId,
      item_id: li.item_id,
      description: li.description,
      qty: li.qty,
      unit_cost: li.unit_cost,
      unit_price: li.unit_price,
      sort_order: idx,
    }))
  );

  if (liError) return { error: liError.message };

  revalidatePath(`/dashboard/templates/${templateId}`);
  redirect(`/dashboard/templates/${templateId}`);
}

export async function toggleTemplateActive(templateId: string, active: boolean) {
  const supabase = await createClient();
  await supabase.from("recurring_invoice_templates").update({ active }).eq("id", templateId);
  revalidatePath(`/dashboard/templates/${templateId}`);
  revalidatePath("/dashboard/templates");
}

export async function deleteTemplate(id: string) {
  const supabase = await createClient();
  await supabase.from("recurring_invoice_templates").delete().eq("id", id);
  revalidatePath("/dashboard/templates");
  redirect("/dashboard/templates");
}
