import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { NewItemForm } from "./new-item-form";

export default async function NewItemPage() {
  const org = await getCurrentOrg();
  if (!org) return null;

  const supabase = await createClient();
  const { data: categoryRows } = await supabase
    .from("items")
    .select("category")
    .eq("org_id", org.orgId)
    .not("category", "is", null);
  const categories = Array.from(new Set((categoryRows ?? []).map((r) => r.category as string))).sort();

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">New item</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">An item code is assigned automatically.</p>
      <NewItemForm categories={categories} />
    </div>
  );
}
