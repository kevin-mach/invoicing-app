"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { getItemsWithDefaultCost } from "@/lib/supabase/items";

export type ChecklistItemInput = {
  item_id: string | null;
  description: string;
  qty: number;
  category: "real" | "cash";
  unit_price: number;
  unit: string;
};

function parseChecklistItems(raw: string): ChecklistItemInput[] {
  try {
    return (JSON.parse(raw) as ChecklistItemInput[]).filter((i) => i.description.trim());
  } catch {
    return [];
  }
}

async function persistChecklistItems(checklistId: string, items: ChecklistItemInput[]) {
  const supabase = await createClient();
  await supabase.from("checklist_items").delete().eq("checklist_id", checklistId);

  if (items.length) {
    await supabase.from("checklist_items").insert(
      items.map((i, idx) => ({
        checklist_id: checklistId,
        item_id: i.item_id,
        description: i.description,
        qty: i.qty,
        category: i.category,
        unit_price: i.unit_price,
        unit: i.unit,
        sort_order: idx,
      }))
    );
  }
}

export async function saveChecklistItems(checklistId: string, formData: FormData) {
  const items = parseChecklistItems(String(formData.get("items") ?? "[]"));
  const supabase = await createClient();
  await persistChecklistItems(checklistId, items);
  await supabase
    .from("checklists")
    .update({ label: String(formData.get("label") ?? "").trim() || null })
    .eq("id", checklistId);

  const { data: checklist } = await supabase
    .from("checklists")
    .select("run_stop_id, run_stops(run_id)")
    .eq("id", checklistId)
    .maybeSingle();
  const runId = (checklist?.run_stops as unknown as { run_id: string } | null)?.run_id;
  if (runId) revalidatePath(`/dashboard/runs/${runId}/checklist/${checklistId}`);
}

export async function togglePriceVisible(checklistId: string, visible: boolean) {
  const supabase = await createClient();
  await supabase.from("checklists").update({ price_visible: visible }).eq("id", checklistId);
}

export async function convertChecklistToPurchase(checklistId: string, currentItems: ChecklistItemInput[]) {
  const org = await getCurrentOrg();
  if (!org) redirect("/onboarding");

  await persistChecklistItems(checklistId, currentItems);

  const supabase = await createClient();
  const { data: checklist } = await supabase
    .from("checklists")
    .select("run_stop_id, run_stops(run_id, vendor_id, runs(run_date))")
    .eq("id", checklistId)
    .maybeSingle();

  const runStop = checklist?.run_stops as unknown as {
    run_id: string;
    vendor_id: string | null;
    runs: { run_date: string } | null;
  } | null;
  if (!runStop?.vendor_id) return;

  const items = currentItems.filter((i) => i.category === "real");
  if (!items.length) return;

  const { data: purchase } = await supabase
    .from("purchases")
    .insert({
      org_id: org.orgId,
      vendor_id: runStop.vendor_id,
      run_id: runStop.run_id,
      ...(runStop.runs?.run_date ? { purchase_date: runStop.runs.run_date } : {}),
    })
    .select("id")
    .single();

  if (!purchase) return;

  await supabase.from("purchase_line_items").insert(
    items.map((i) => ({
      purchase_id: purchase.id,
      item_id: i.item_id,
      description: i.description,
      qty: i.qty,
      unit_cost: i.unit_price,
    }))
  );

  redirect(`/dashboard/purchases/${purchase.id}`);
}

export async function convertChecklistToInvoice(checklistId: string, currentItems: ChecklistItemInput[]) {
  const org = await getCurrentOrg();
  if (!org) redirect("/onboarding");

  await persistChecklistItems(checklistId, currentItems);

  const supabase = await createClient();
  const { data: checklist } = await supabase
    .from("checklists")
    .select("run_stop_id, run_stops(run_id, customer_id, runs(run_date))")
    .eq("id", checklistId)
    .maybeSingle();

  const runStop = checklist?.run_stops as unknown as {
    run_id: string;
    customer_id: string | null;
    runs: { run_date: string } | null;
  } | null;
  if (!runStop?.customer_id) return;

  const items = currentItems.filter((i) => i.category === "real");
  if (!items.length) return;

  const catalog = await getItemsWithDefaultCost(org.orgId);
  const costByItemId = new Map(catalog.map((c) => [c.id, c.default_cost]));
  const vatRateByItemId = new Map(catalog.map((c) => [c.id, c.vat_rate]));

  const { data: invoice } = await supabase
    .from("invoices")
    .insert({
      org_id: org.orgId,
      customer_id: runStop.customer_id,
      run_id: runStop.run_id,
      ...(runStop.runs?.run_date ? { issue_date: runStop.runs.run_date } : {}),
    })
    .select("id")
    .single();

  if (!invoice) return;

  await supabase.from("invoice_line_items").insert(
    items.map((i, idx) => ({
      invoice_id: invoice.id,
      item_id: i.item_id,
      description: i.description,
      qty: i.qty,
      unit_price: i.unit_price,
      unit_cost: i.item_id ? costByItemId.get(i.item_id) ?? 0 : 0,
      vat_rate: i.item_id ? vatRateByItemId.get(i.item_id) ?? 20 : 20,
      sort_order: idx,
    }))
  );

  redirect(`/dashboard/invoices/${invoice.id}`);
}
