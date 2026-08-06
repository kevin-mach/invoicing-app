import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { getItemsWithDefaultCost } from "@/lib/supabase/items";
import { RunReportExport, type RunReportLine, type VendorStopData } from "./run-report-export";
import type { CustomerStopData } from "../stock-sheet/stock-sheet-builder";

export default async function RunReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await getCurrentOrg();
  if (!org) return null;

  const supabase = await createClient();
  const [
    { data: run },
    { data: purchases },
    { data: invoices },
    { data: checklistItems },
    { data: customerStopRows },
    { data: vendorStopRows },
    items,
  ] = await Promise.all([
    supabase.from("runs").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("purchases")
      .select("id, vendors(name), purchase_line_items(description, qty, unit_cost)")
      .eq("run_id", id),
    supabase
      .from("invoices")
      .select("id, customers(name), invoice_line_items(description, qty, unit_price)")
      .eq("run_id", id),
    supabase
      .from("checklist_items")
      .select("description, qty, category, unit_price, checklists(run_stops(run_id, vendors(name), customers(name)))")
      .eq("category", "cash"),
    supabase
      .from("run_stops")
      .select("id, customers(name), checklists(checklist_items(item_id, description, qty, unit))")
      .eq("run_id", id)
      .eq("stop_type", "customer"),
    supabase
      .from("run_stops")
      .select("id, vendors(name), checklists(label, checklist_items(item_id, description, qty, unit))")
      .eq("run_id", id)
      .eq("stop_type", "vendor"),
    getItemsWithDefaultCost(org.orgId),
  ]);

  if (!run) notFound();

  const customerStops: CustomerStopData[] = (customerStopRows ?? [])
    .map((stop) => {
      const customerName = (stop.customers as unknown as { name: string } | null)?.name ?? "—";
      const checklist = stop.checklists as unknown as {
        checklist_items: { item_id: string | null; description: string; qty: number; unit: string }[];
      } | null;
      return { stopId: stop.id, customerName, items: checklist?.checklist_items ?? [] };
    })
    .filter((stop) => stop.items.length > 0);

  const vendorStops: VendorStopData[] = (vendorStopRows ?? [])
    .map((stop) => {
      const vendorName = (stop.vendors as unknown as { name: string } | null)?.name ?? "—";
      const checklist = stop.checklists as unknown as {
        label: string | null;
        checklist_items: { item_id: string | null; description: string; qty: number; unit: string }[];
      } | null;
      return { stopId: stop.id, vendorName, label: checklist?.label ?? null, items: checklist?.checklist_items ?? [] };
    })
    .filter((stop) => stop.items.length > 0);

  const lines: RunReportLine[] = [];

  for (const p of purchases ?? []) {
    const vendorName = (p.vendors as unknown as { name: string } | null)?.name ?? "—";
    for (const li of (p.purchase_line_items ?? []) as { description: string; qty: number; unit_cost: number }[]) {
      lines.push({
        type: "purchase",
        entity: vendorName,
        description: li.description,
        qty: li.qty,
        amount: li.qty * li.unit_cost,
      });
    }
  }

  for (const inv of invoices ?? []) {
    const customerName = (inv.customers as unknown as { name: string } | null)?.name ?? "—";
    for (const li of (inv.invoice_line_items ?? []) as { description: string; qty: number; unit_price: number }[]) {
      lines.push({
        type: "invoice",
        entity: customerName,
        description: li.description,
        qty: li.qty,
        amount: li.qty * li.unit_price,
      });
    }
  }

  const cashLines: RunReportLine[] = (checklistItems ?? [])
    .filter((ci) => {
      const stop = (ci.checklists as unknown as { run_stops: { run_id: string } | null } | null)?.run_stops;
      return stop?.run_id === id;
    })
    .map((ci) => {
      const stop = (ci.checklists as unknown as {
        run_stops: { vendors: { name: string } | null; customers: { name: string } | null } | null;
      }).run_stops;
      const entity = stop?.vendors?.name ?? stop?.customers?.name ?? "—";
      return { type: "cash" as const, entity, description: ci.description, qty: ci.qty, amount: ci.qty * ci.unit_price };
    });

  const totalCost = lines.filter((l) => l.type === "purchase").reduce((s, l) => s + l.amount, 0);
  const totalRevenue = lines.filter((l) => l.type === "invoice").reduce((s, l) => s + l.amount, 0);
  const totalCash = cashLines.reduce((s, l) => s + l.amount, 0);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Condensed report — {run.run_date}</h1>

      <RunReportExport
        runDate={run.run_date}
        orgName={org.orgName}
        customerStops={customerStops}
        vendorStops={vendorStops}
        items={items}
        lines={[...lines, ...cashLines]}
        totalCost={totalCost}
        totalRevenue={totalRevenue}
        totalCash={totalCash}
      />
    </div>
  );
}
