import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/supabase/org";
import { DashboardNav } from "@/components/dashboard-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const org = await getCurrentOrg();

  if (!org) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <DashboardNav orgName={org.orgName} />
      <main className="flex-1 overflow-x-hidden bg-slate-50 p-4 md:p-8 dark:bg-slate-950">
        {children}
      </main>
    </div>
  );
}
