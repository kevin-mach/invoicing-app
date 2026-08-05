import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { RunReportExport, type RunReportLine } from "./run-report-export";

export default async function RunReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await getCurrentOrg();
  if (!org) return null;

  const supabase = await createClient();
  const [{ data: run }, { data: purchases }, { data: invoices }, { data: checklistItems }] = await Promise.all([
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
  ]);

  if (!run) notFound();

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
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Stock sheet report — {run.run_date}</h1>

      <RunReportExport
        runDate={run.run_date}
        orgName={org.orgName}
        lines={[...lines, ...cashLines]}
        totalCost={totalCost}
        totalRevenue={totalRevenue}
        totalCash={totalCash}
      />
    </div>
  );
}
