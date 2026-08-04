import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { getItemsWithDefaultCost } from "@/lib/supabase/items";
import { ChecklistEditor } from "./checklist-editor";

export default async function ChecklistPage({
  params,
}: {
  params: Promise<{ id: string; checklistId: string }>;
}) {
  const { checklistId } = await params;
  const org = await getCurrentOrg();
  if (!org) return null;

  const supabase = await createClient();
  const [{ data: checklist }, { data: checklistItems }, items] = await Promise.all([
    supabase
      .from("checklists")
      .select("*, run_stops(stop_type, customer_id, vendor_id, vendors(name), customers(name))")
      .eq("id", checklistId)
      .maybeSingle(),
    supabase.from("checklist_items").select("*").eq("checklist_id", checklistId).order("sort_order"),
    getItemsWithDefaultCost(org.orgId),
  ]);

  if (!checklist) notFound();

  const runStop = checklist.run_stops as unknown as {
    stop_type: "vendor" | "customer";
    customer_id: string | null;
    vendor_id: string | null;
    vendors: { name: string } | null;
    customers: { name: string } | null;
  };
  const stopName = runStop.stop_type === "vendor" ? runStop.vendors?.name : runStop.customers?.name;
  const stopEntityId = runStop.stop_type === "vendor" ? runStop.vendor_id : runStop.customer_id;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
        Checklist — {stopName ?? "—"}
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 capitalize">
        {runStop.stop_type === "vendor" ? "Pick up from vendor" : "Deliver to customer"}
      </p>

      <div className="mt-6">
        <ChecklistEditor
          checklistId={checklist.id}
          stopType={runStop.stop_type}
          stopEntityId={stopEntityId}
          items={items}
          initialItems={(checklistItems ?? []).map((i) => ({
            item_id: i.item_id,
            description: i.description,
            qty: i.qty,
            category: i.category as "real" | "cash",
            unit_price: i.unit_price,
          }))}
          initialPriceVisible={checklist.price_visible}
        />
      </div>
    </div>
  );
}
