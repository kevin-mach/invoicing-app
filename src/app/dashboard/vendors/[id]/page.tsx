import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditVendorForm } from "./edit-form";

export default async function EditVendorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: vendor } = await supabase.from("vendors").select("*").eq("id", id).maybeSingle();

  if (!vendor) notFound();

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{vendor.name}</h1>
      <EditVendorForm vendor={vendor} />
    </div>
  );
}
