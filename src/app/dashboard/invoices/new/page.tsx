import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { getItemsWithDefaultCost } from "@/lib/supabase/items";
import { InvoiceForm } from "@/components/invoice-form";
import { createInvoice } from "../actions";

export default async function NewInvoicePage() {
  const org = await getCurrentOrg();
  if (!org) return null;

  const supabase = await createClient();
  const [{ data: customers }, items] = await Promise.all([
    supabase.from("customers").select("id, name").eq("org_id", org.orgId).order("name"),
    getItemsWithDefaultCost(org.orgId),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">New invoice</h1>
      <InvoiceForm action={createInvoice} customers={customers ?? []} items={items} submitLabel="Create invoice" />
    </div>
  );
}
