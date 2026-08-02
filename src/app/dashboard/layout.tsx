import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentOrg, daysUntil } from "@/lib/supabase/org";
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

  if (!org.hasAccess) {
    redirect("/billing/upgrade");
  }

  const showTrialBanner = org.subscriptionStatus === "trialing" && !org.subscriptionExempt;
  const trialDaysLeft = showTrialBanner ? daysUntil(org.trialEndsAt) : 0;

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <DashboardNav orgName={org.orgName} role={org.role} />
      <div className="flex flex-1 flex-col overflow-x-hidden">
        {showTrialBanner ? (
          <div className="no-print flex items-center justify-between gap-3 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            <span>
              {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left in your free trial.
            </span>
            <Link href="/billing/upgrade" className="font-medium underline">
              Upgrade
            </Link>
          </div>
        ) : null}
        <main className="flex-1 bg-slate-50 p-4 md:p-8 dark:bg-slate-950">{children}</main>
      </div>
    </div>
  );
}
