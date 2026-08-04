import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { EditItemForm } from "./edit-form";

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await getCurrentOrg();
  if (!org) return null;

  const supabase = await createClient();
  const [{ data: item }, { data: categoryRows }] = await Promise.all([
    supabase.from("items").select("*").eq("id", id).maybeSingle(),
    supabase.from("items").select("category").eq("org_id", org.orgId).not("category", "is", null),
  ]);

  if (!item) notFound();

  const categories = Array.from(new Set((categoryRows ?? []).map((r) => r.category as string))).sort();

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{item.name}</h1>
      <EditItemForm item={item} categories={categories} />
    </div>
  );
}
