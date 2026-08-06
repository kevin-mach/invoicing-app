import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { TIERS, DEFAULT_TIER, type TierKey } from "@/lib/billing/plans";

export const TRIAL_DAYS = 5;

/** Whole days remaining until `dateStr`, floored at 0. */
export function daysUntil(dateStr: string): number {
  return Math.max(0, Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000));
}

export type CurrentOrg = {
  orgId: string;
  orgName: string;
  role: "owner" | "admin" | "staff" | "bookkeeper";
  userId: string;
  userEmail: string;
  trialEndsAt: string;
  subscriptionStatus: "trialing" | "active" | "canceled";
  subscriptionPlan: "monthly" | "yearly" | null;
  subscriptionTier: TierKey;
  subscriptionExempt: boolean;
  /** True if the org can use the app right now: exempt, actively subscribed, or still within the trial window. */
  hasAccess: boolean;
  /** Seat cap for the org's current tier (or the Starter cap while still on trial). */
  maxUsers: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
};

/** Returns the signed-in user's first organization, or null if they have none yet.
 * Wrapped in React's cache() so the layout and the page it wraps share one lookup per request
 * instead of each doing its own auth check + DB round trip. */
export const getCurrentOrg = cache(async (): Promise<CurrentOrg | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membership } = await supabase
    .from("org_members")
    .select(
      "org_id, role, organizations(name, trial_ends_at, subscription_status, subscription_plan, subscription_tier, subscription_exempt, stripe_customer_id, stripe_subscription_id, cancel_at_period_end, current_period_end)"
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
    subscription_tier: string;
    subscription_exempt: boolean;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    cancel_at_period_end: boolean;
    current_period_end: string | null;
  } | null;

  if (!org) return null;

  const isTrialActive = new Date(org.trial_ends_at).getTime() > Date.now();
  const hasAccess = org.subscription_exempt || org.subscription_status === "active" || isTrialActive;
  const subscriptionTier = (org.subscription_tier as TierKey) ?? DEFAULT_TIER;

  return {
    orgId: membership.org_id,
    orgName: org.name,
    role: membership.role as CurrentOrg["role"],
    userId: user.id,
    userEmail: user.email ?? "",
    trialEndsAt: org.trial_ends_at,
    subscriptionStatus: org.subscription_status as CurrentOrg["subscriptionStatus"],
    subscriptionPlan: org.subscription_plan as CurrentOrg["subscriptionPlan"],
    subscriptionTier,
    subscriptionExempt: org.subscription_exempt,
    hasAccess,
    maxUsers: TIERS[subscriptionTier].maxUsers,
    stripeCustomerId: org.stripe_customer_id,
    stripeSubscriptionId: org.stripe_subscription_id,
    cancelAtPeriodEnd: org.cancel_at_period_end,
    currentPeriodEnd: org.current_period_end,
  };
});
