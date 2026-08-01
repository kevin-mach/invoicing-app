import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { getCurrentOrg, daysUntil } from "@/lib/supabase/org";
import { PLANS, PLAN_FEATURES } from "@/lib/billing/plans";
import { selectPlan } from "./actions";

export default async function UpgradePage() {
  const org = await getCurrentOrg();
  if (!org) redirect("/login");

  const daysLeft = daysUntil(org.trialEndsAt);
  const isTrialActive = daysLeft > 0;

  return (
    <main className="flex min-h-dvh flex-col items-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-3xl">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
            {isTrialActive ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in your trial` : "Your trial has ended"}
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Choose a plan to keep using {org.orgName}&apos;s workspace.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {(Object.values(PLANS)).map((plan) => (
            <div
              key={plan.key}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{plan.label}</p>
              <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-50">
                {plan.priceLabel}
                <span className="text-base font-normal text-slate-500 dark:text-slate-400">{plan.cadenceLabel}</span>
              </p>
              {plan.note ? (
                <p className="mt-1 text-sm font-medium text-green-600 dark:text-green-400">{plan.note}</p>
              ) : (
                <p className="mt-1 text-sm text-transparent">placeholder</p>
              )}

              <form action={selectPlan.bind(null, plan.key)} className="mt-6">
                <button
                  type="submit"
                  className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-50 dark:text-slate-900"
                >
                  Choose {plan.label}
                </button>
              </form>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">What&apos;s included</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {PLAN_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Check size={16} className="mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
