import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { getItemsWithDefaultCost } from "@/lib/supabase/items";
import { TemplateForm } from "@/components/template-form";
import { createTemplate } from "../actions";

export default async function NewTemplatePage() {
  const org = await getCurrentOrg();
  if (!org) return null;

  const supabase = await createClient();
  const [{ data: customers }, items] = await Promise.all([
    supabase.from("customers").select("id, name").eq("org_id", org.orgId).order("name"),
    getItemsWithDefaultCost(org.orgId),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">New recurring template</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        A draft invoice is generated automatically on each run date for review before sending.
      </p>
      <TemplateForm action={createTemplate} customers={customers ?? []} items={items} submitLabel="Create template" />
    </div>
  );
}
