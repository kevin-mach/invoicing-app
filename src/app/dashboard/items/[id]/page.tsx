import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditItemForm } from "./edit-form";

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: item } = await supabase.from("items").select("*").eq("id", id).maybeSingle();

  if (!item) notFound();

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{item.name}</h1>
      <EditItemForm item={item} />
    </div>
  );
}
