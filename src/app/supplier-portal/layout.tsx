import { redirect } from "next/navigation";
import { getCurrentVendorMember } from "@/lib/supabase/identity";
import { SupplierPortalNav } from "@/components/supplier-portal-nav";
import { HowTo } from "@/components/how-to";

export default async function SupplierPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const member = await getCurrentVendorMember();

  if (!member) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <SupplierPortalNav vendorName={member.vendorName} role={member.role} />
      <div className="flex flex-1 flex-col overflow-x-hidden">
        <main className="flex-1 bg-slate-50 p-4 md:p-8 dark:bg-slate-950">
          <HowTo />
          {children}
        </main>
      </div>
    </div>
  );
}
