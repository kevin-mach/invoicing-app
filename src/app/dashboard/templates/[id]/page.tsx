import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { getItemsWithDefaultCost } from "@/lib/supabase/items";
import { TemplateForm } from "@/components/template-form";
import { updateTemplate } from "../actions";
import { TemplateActions } from "./template-actions";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await getCurrentOrg();
  if (!org) return null;

  const supabase = await createClient();
  const [{ data: template }, { data: lineItems }, { data: customers }, items] = await Promise.all([
    supabase.from("recurring_invoice_templates").select("*, customers(name)").eq("id", id).maybeSingle(),
    supabase.from("recurring_invoice_template_items").select("*").eq("template_id", id).order("sort_order"),
    supabase.from("customers").select("id, name").eq("org_id", org.orgId).order("name"),
    getItemsWithDefaultCost(org.orgId),
  ]);

  if (!template) notFound();

  const updateWithId = updateTemplate.bind(null, template.id);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
        Recurring — {(template.customers as unknown as { name: string } | null)?.name ?? "—"}
      </h1>
      <div className="mt-4">
        <TemplateActions templateId={template.id} active={template.active} />
      </div>
      <TemplateForm
        action={updateWithId}
        customers={customers ?? []}
        items={items}
        initialCustomerId={template.customer_id}
        initialCadence={template.cadence}
        initialNextRunDate={template.next_run_date}
        initialLineItems={(lineItems ?? []).map((li) => ({
          item_id: li.item_id,
          description: li.description,
          qty: li.qty,
          unit_cost: li.unit_cost,
          unit_price: li.unit_price,
        }))}
        submitLabel="Save changes"
      />
    </div>
  );
}
