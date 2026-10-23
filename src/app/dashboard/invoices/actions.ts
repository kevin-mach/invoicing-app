"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { cleanPropertyDetails } from "@/lib/property";
import type { Json } from "@/lib/supabase/types";

export type InvoiceFormState = { error: string | null };

export type LineItemInput = {
  item_id: string | null;
  description: string;
  qty: number;
  unit_cost: number;
  unit_price: number;
  vat_rate: number;
};

function parseLineItems(raw: string): LineItemInput[] {
  try {
    const parsed = JSON.parse(raw) as LineItemInput[];
    return parsed.filter((li) => li.description.trim().length > 0);
  } catch {
    return [];
  }
}

/** The property section of a property company's invoice, from the form's hidden JSON field (null when empty). */
function propertyFromForm(formData: FormData): Json | null {
  const raw = String(formData.get("property_details") ?? "");
  if (!raw) return null;
  try {
    return cleanPropertyDetails(JSON.parse(raw)) as unknown as Json | null;
  } catch {
    return null;
  }
}

/** The invoice date when the form gave a valid one; otherwise nothing, so today's date applies (new) or the old date stays (edit). */
function issueDateFromForm(formData: FormData): { issue_date?: string } {
  const v = String(formData.get("issue_date") ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? { issue_date: v } : {};
}

export async function createInvoice(
  _prevState: InvoiceFormState,
  formData: FormData
): Promise<InvoiceFormState> {
  const org = await getCurrentOrg();
  if (!org) redirect("/onboarding");

  const customerId = String(formData.get("customer_id") ?? "");
  if (!customerId) return { error: "Select a customer." };

  const lineItems = parseLineItems(String(formData.get("line_items") ?? "[]"));
  if (!lineItems.length) return { error: "Add at least one line item." };

  const supabase = await createClient();
  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      org_id: org.orgId,
      customer_id: customerId,
      due_date: String(formData.get("due_date") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
      tax: Number(formData.get("tax") ?? 0) || 0,
      vat_on_top: formData.get("vat_on_top") === "on",
      property_details: propertyFromForm(formData),
      ...issueDateFromForm(formData),
    })
    .select("id")
    .single();

  if (error || !invoice) return { error: error?.message ?? "Could not create invoice." };

  const { error: liError } = await supabase.from("invoice_line_items").insert(
    lineItems.map((li, i) => ({
      invoice_id: invoice.id,
      item_id: li.item_id,
      description: li.description,
      qty: li.qty,
      unit_cost: li.unit_cost,
      unit_price: li.unit_price,
      vat_rate: li.vat_rate,
      sort_order: i,
    }))
  );

  if (liError) return { error: liError.message };

  revalidatePath("/dashboard/invoices");
  redirect(`/dashboard/invoices/${invoice.id}`);
}

export async function updateInvoiceLineItems(
  invoiceId: string,
  _prevState: InvoiceFormState,
  formData: FormData
): Promise<InvoiceFormState> {
  const customerId = String(formData.get("customer_id") ?? "");
  if (!customerId) return { error: "Select a customer." };

  const lineItems = parseLineItems(String(formData.get("line_items") ?? "[]"));
  if (!lineItems.length) return { error: "Add at least one line item." };

  const supabase = await createClient();

  const { error: invError } = await supabase
    .from("invoices")
    .update({
      customer_id: customerId,
      due_date: String(formData.get("due_date") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
      tax: Number(formData.get("tax") ?? 0) || 0,
      vat_on_top: formData.get("vat_on_top") === "on",
      property_details: propertyFromForm(formData),
      ...issueDateFromForm(formData),
    })
    .eq("id", invoiceId);

  if (invError) return { error: invError.message };

  await supabase.from("invoice_line_items").delete().eq("invoice_id", invoiceId);

  const { error: liError } = await supabase.from("invoice_line_items").insert(
    lineItems.map((li, i) => ({
      invoice_id: invoiceId,
      item_id: li.item_id,
      description: li.description,
      qty: li.qty,
      unit_cost: li.unit_cost,
      unit_price: li.unit_price,
      vat_rate: li.vat_rate,
      sort_order: i,
    }))
  );

  if (liError) return { error: liError.message };

  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  redirect(`/dashboard/invoices/${invoiceId}`);
}

export async function updateInvoiceStatus(invoiceId: string, status: string) {
  const supabase = await createClient();
  await supabase.from("invoices").update({ status }).eq("id", invoiceId);
  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  revalidatePath("/dashboard/invoices");
}

export async function deleteInvoice(id: string) {
  const supabase = await createClient();
  await supabase.from("invoices").delete().eq("id", id);
  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}
