import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditCustomerForm } from "./edit-form";
import { PortalAccess } from "./portal-access";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: customer }, { data: members }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    supabase.rpc("get_customer_members", { p_customer_id: id }),
  ]);

  if (!customer) notFound();

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{customer.name}</h1>
      <EditCustomerForm customer={customer} />
      <PortalAccess customerId={id} members={members ?? []} />
    </div>
  );
}
