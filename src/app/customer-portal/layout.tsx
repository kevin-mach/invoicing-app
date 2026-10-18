import { redirect } from "next/navigation";
import { getCurrentCustomerMember } from "@/lib/supabase/identity";
import { CustomerPortalNav } from "@/components/customer-portal-nav";

export default async function CustomerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const member = await getCurrentCustomerMember();

  if (!member) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <CustomerPortalNav customerName={member.customerName} role={member.role} />
      <div className="flex flex-1 flex-col overflow-x-hidden">
        <main className="flex-1 bg-slate-50 p-4 md:p-8 dark:bg-slate-950">{children}</main>
      </div>
    </div>
  );
}
