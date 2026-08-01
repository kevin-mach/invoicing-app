import { createClient } from "@/lib/supabase/server";

export const TRIAL_DAYS = 5;

/** Whole days remaining until `dateStr`, floored at 0. */
export function daysUntil(dateStr: string): number {
  return Math.max(0, Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000));
}

export type CurrentOrg = {
  orgId: string;
  orgName: string;
  role: "owner" | "admin" | "staff";
  userId: string;
  userEmail: string;
  trialEndsAt: string;
  subscriptionStatus: "trialing" | "active" | "canceled";
  subscriptionPlan: "monthly" | "yearly" | null;
  subscriptionExempt: boolean;
  /** True if the org can use the app right now: exempt, actively subscribed, or still within the trial window. */
  hasAccess: boolean;
};

/** Returns the signed-in user's first organization, or null if they have none yet. */
export async function getCurrentOrg(): Promise<CurrentOrg | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membership } = await supabase
    .from("org_members")
    .select(
      "org_id, role, organizations(name, trial_ends_at, subscription_status, subscription_plan, subscription_exempt)"
    )
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const org = membership.organizations as unknown as {
    name: string;
    trial_ends_at: string;
    subscription_status: string;
    subscription_plan: string | null;
    subscription_exempt: boolean;
  } | null;

  if (!org) return null;

  const isTrialActive = new Date(org.trial_ends_at).getTime() > Date.now();
  const hasAccess = org.subscription_exempt || org.subscription_status === "active" || isTrialActive;

  return {
    orgId: membership.org_id,
    orgName: org.name,
    role: membership.role as CurrentOrg["role"],
    userId: user.id,
    userEmail: user.email ?? "",
    trialEndsAt: org.trial_ends_at,
    subscriptionStatus: org.subscription_status as CurrentOrg["subscriptionStatus"],
    subscriptionPlan: org.subscription_plan as CurrentOrg["subscriptionPlan"],
    subscriptionExempt: org.subscription_exempt,
    hasAccess,
  };
}
