import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { getItemsWithDefaultCost } from "@/lib/supabase/items";
import { StockSheetBuilder, type CustomerStopData } from "./stock-sheet-builder";

export default async function StockSheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await getCurrentOrg();
  if (!org) return null;

  const supabase = await createClient();
  const [{ data: run }, { data: stops }, { data: vendors }, items] = await Promise.all([
    supabase.from("runs").select("run_date").eq("id", id).maybeSingle(),
    supabase
      .from("run_stops")
      .select("id, customers(name), checklists(checklist_items(item_id, description, qty, unit))")
      .eq("run_id", id)
      .eq("stop_type", "customer"),
    supabase.from("vendors").select("id, name").eq("org_id", org.orgId).order("name"),
    getItemsWithDefaultCost(org.orgId),
  ]);

  if (!run) notFound();

  const customerStops: CustomerStopData[] = (stops ?? []).map((stop) => {
    const customerName = (stop.customers as unknown as { name: string } | null)?.name ?? "—";
    const checklist = stop.checklists as unknown as {
      checklist_items: { item_id: string | null; description: string; qty: number; unit: string }[];
    } | null;
    return {
      stopId: stop.id,
      customerName,
      items: checklist?.checklist_items ?? [],
    };
  });

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
        Stock sheet — {run.run_date}
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Total quantity needed per item across today&apos;s customer orders, so you can allocate what to buy from each
        supplier.
      </p>

      <StockSheetBuilder
        orgName={org.orgName}
        runDate={run.run_date}
        customerStops={customerStops}
        vendors={vendors ?? []}
        items={items}
      />
    </div>
  );
}
