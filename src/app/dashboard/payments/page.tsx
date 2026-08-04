import Link from "next/link";
import { getCurrentOrg } from "@/lib/supabase/org";
import { TIERS, type Cadence } from "@/lib/billing/plans";
import { ManageBillingButton } from "./manage-billing-button";
import { PlanSwitcher } from "./plan-switcher";
import { CancelSubscription } from "./cancel-subscription";

const STATUS_LABEL: Record<string, string> = {
  trialing: "Trial",
  active: "Active",
  canceled: "Canceled",
};

export default async function PaymentsPage() {
  const org = await getCurrentOrg();
  if (!org) return null;

  if (org.role !== "owner") {
    return (
      <div className="max-w-lg">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Payments</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Only the account owner can view and manage billing.
        </p>
      </div>
    );
  }

  const hasSubscription = Boolean(org.stripeSubscriptionId);
  const cadence: Cadence = org.subscriptionPlan ?? "monthly";

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Payments</h1>

      <div className="mt-6 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Current plan</p>
          <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
            {TIERS[org.subscriptionTier].label}
            {hasSubscription ? ` (${cadence})` : ""}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            org.subscriptionStatus === "active"
              ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
              : org.subscriptionStatus === "trialing"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          {STATUS_LABEL[org.subscriptionStatus] ?? org.subscriptionStatus}
        </span>
      </div>

      {!hasSubscription ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            You don&apos;t have an active subscription yet.
          </p>
          <Link
            href="/billing/upgrade"
            className="mt-3 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-50 dark:text-slate-900"
          >
            Choose a plan
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-medium text-slate-900 dark:text-slate-50">Payment method &amp; invoices</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Update your card on file or download past invoices via Stripe&apos;s secure billing portal.
            </p>
            <div className="mt-4">
              <ManageBillingButton />
            </div>
          </div>

          <div className="mt-6">
            <h2 className="font-medium text-slate-900 dark:text-slate-50">Change plan</h2>
            <div className="mt-4">
              <PlanSwitcher currentTier={org.subscriptionTier} currentCadence={cadence} />
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-medium text-slate-900 dark:text-slate-50">Cancel subscription</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              You&apos;ll keep access until the end of the current billing period.
            </p>
            <div className="mt-4">
              <CancelSubscription cancelAtPeriodEnd={org.cancelAtPeriodEnd} currentPeriodEnd={org.currentPeriodEnd} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
