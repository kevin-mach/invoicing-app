"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";

export type QuoteFormState = { error: string | null };

export type QuoteLineItemInput = {
  item_id: string | null;
  description: string;
  qty: number;
  unit_price: number;
};

function parseLineItems(raw: string): QuoteLineItemInput[] {
  try {
    const parsed = JSON.parse(raw) as QuoteLineItemInput[];
    return parsed.filter((li) => li.description.trim().length > 0);
  } catch {
    return [];
  }
}

export async function createQuote(
  _prevState: QuoteFormState,
  formData: FormData
): Promise<QuoteFormState> {
  const org = await getCurrentOrg();
  if (!org) redirect("/onboarding");

  const recipientName = String(formData.get("recipient_name") ?? "").trim();
  if (!recipientName) return { error: "Enter a name for the recipient." };

  const lineItems = parseLineItems(String(formData.get("line_items") ?? "[]"));
  if (!lineItems.length) return { error: "Add at least one item." };

  const supabase = await createClient();
  const { data: quote, error } = await supabase
    .from("quotes")
    .insert({
      org_id: org.orgId,
      recipient_name: recipientName,
      recipient_contact: String(formData.get("recipient_contact") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
    })
    .select("id")
    .single();

  if (error || !quote) return { error: error?.message ?? "Could not create quote." };

  const { error: liError } = await supabase.from("quote_line_items").insert(
    lineItems.map((li, i) => ({
      quote_id: quote.id,
      item_id: li.item_id,
      description: li.description,
      qty: li.qty,
      unit_price: li.unit_price,
      sort_order: i,
    }))
  );

  if (liError) return { error: liError.message };

  revalidatePath("/dashboard/quotes");
  redirect(`/dashboard/quotes/${quote.id}`);
}

export async function updateQuote(
  quoteId: string,
  _prevState: QuoteFormState,
  formData: FormData
): Promise<QuoteFormState> {
  const recipientName = String(formData.get("recipient_name") ?? "").trim();
  if (!recipientName) return { error: "Enter a name for the recipient." };

  const lineItems = parseLineItems(String(formData.get("line_items") ?? "[]"));
  if (!lineItems.length) return { error: "Add at least one item." };

  const supabase = await createClient();

  const { error: quoteError } = await supabase
    .from("quotes")
    .update({
      recipient_name: recipientName,
      recipient_contact: String(formData.get("recipient_contact") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
    })
    .eq("id", quoteId);

  if (quoteError) return { error: quoteError.message };

  await supabase.from("quote_line_items").delete().eq("quote_id", quoteId);

  const { error: liError } = await supabase.from("quote_line_items").insert(
    lineItems.map((li, i) => ({
      quote_id: quoteId,
      item_id: li.item_id,
      description: li.description,
      qty: li.qty,
      unit_price: li.unit_price,
      sort_order: i,
    }))
  );

  if (liError) return { error: liError.message };

  revalidatePath(`/dashboard/quotes/${quoteId}`);
  redirect(`/dashboard/quotes/${quoteId}`);
}

export async function deleteQuote(id: string) {
  const supabase = await createClient();
  await supabase.from("quotes").delete().eq("id", id);
  revalidatePath("/dashboard/quotes");
  redirect("/dashboard/quotes");
}
