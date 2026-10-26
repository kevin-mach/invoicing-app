import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { getItemsWithDefaultCost } from "@/lib/supabase/items";
import { PurchaseForm } from "@/components/purchase-form";
import { createPurchase } from "../actions";
import { getProductGroups } from "@/lib/bookkeeping/product-groups";

export default async function NewPurchasePage() {
  const org = await getCurrentOrg();
  if (!org) return null;

  const supabase = await createClient();
  const [{ data: vendors }, items, groups] = await Promise.all([
    supabase.from("vendors").select("id, name").eq("org_id", org.orgId).order("name"),
    getItemsWithDefaultCost(org.orgId),
    getProductGroups(org.orgId),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">New purchase</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Scan a receipt to auto-fill line items, or add them manually.
      </p>
      <PurchaseForm
        action={createPurchase}
        orgId={org.orgId}
        vendors={vendors ?? []}
        items={items}
        groups={groups}
        submitLabel="Save purchase"
        autoSaveScans={org.autoSaveScans}
        propertyMode={org.businessType === "property"}
      />
    </div>
  );
}
