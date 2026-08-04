"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentOrg } from "@/lib/supabase/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import { TIERS, type TierKey, type Cadence } from "@/lib/billing/plans";

export type PaymentActionResult = { error: string | null };

/** Opens Stripe's hosted Billing Portal, where the owner can update their card, view invoices,
 * and (if enabled in the Stripe dashboard) cancel from there too. */
export async function openBillingPortal(): Promise<PaymentActionResult> {
  const org = await getCurrentOrg();
  if (!org) redirect("/login");
  if (org.role !== "owner") return { error: "Only the account owner can manage billing." };
  if (!org.stripeCustomerId) return { error: "No billing account yet — start a subscription first." };

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return { error: "Payments aren't configured yet — ask the app owner to finish Stripe setup." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200";
  let session;
  try {
    session = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${siteUrl}/dashboard/payments`,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not open the billing portal. Try again." };
  }

  redirect(session.url);
}

/** Changes the price on the org's existing subscription (upgrade/downgrade), prorating the difference,
 * instead of starting a brand-new subscription via Checkout. */
export async function changePlan(tier: TierKey, cadence: Cadence): Promise<PaymentActionResult> {
  const org = await getCurrentOrg();
  if (!org) return { error: "You must be signed in." };
  if (org.role !== "owner") return { error: "Only the account owner can change the plan." };
  if (!org.stripeSubscriptionId) return { error: "Start a subscription first." };

  const priceId = TIERS[tier][cadence].stripePriceId;
  if (!priceId) return { error: "This plan isn't available for checkout yet." };

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return { error: "Payments aren't configured yet — ask the app owner to finish Stripe setup." };
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
    const itemId = subscription.items.data[0]?.id;
    if (!itemId) return { error: "Could not find your subscription details." };

    await stripe.subscriptions.update(org.stripeSubscriptionId, {
      items: [{ id: itemId, price: priceId }],
      proration_behavior: "create_prorations",
      metadata: { org_id: org.orgId, tier },
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not change the plan. Try again." };
  }

  try {
    const admin = createAdminClient();
    await admin
      .from("organizations")
      .update({ subscription_tier: tier, subscription_plan: cadence })
      .eq("id", org.orgId);
  } catch {
    // The webhook will sync it shortly regardless.
  }

  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/team");
  return { error: null };
}

export async function cancelSubscription(): Promise<PaymentActionResult> {
  const org = await getCurrentOrg();
  if (!org) return { error: "You must be signed in." };
  if (org.role !== "owner") return { error: "Only the account owner can cancel the subscription." };
  if (!org.stripeSubscriptionId) return { error: "No active subscription to cancel." };

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return { error: "Payments aren't configured yet — ask the app owner to finish Stripe setup." };
  }

  try {
    await stripe.subscriptions.update(org.stripeSubscriptionId, { cancel_at_period_end: true });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not cancel the subscription. Try again." };
  }

  try {
    const admin = createAdminClient();
    await admin.from("organizations").update({ cancel_at_period_end: true }).eq("id", org.orgId);
  } catch {
    // The webhook will sync it shortly regardless.
  }

  revalidatePath("/dashboard/payments");
  return { error: null };
}

export async function resumeSubscription(): Promise<PaymentActionResult> {
  const org = await getCurrentOrg();
  if (!org) return { error: "You must be signed in." };
  if (org.role !== "owner") return { error: "Only the account owner can resume the subscription." };
  if (!org.stripeSubscriptionId) return { error: "No subscription to resume." };

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return { error: "Payments aren't configured yet — ask the app owner to finish Stripe setup." };
  }

  try {
    await stripe.subscriptions.update(org.stripeSubscriptionId, { cancel_at_period_end: false });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not resume the subscription. Try again." };
  }

  try {
    const admin = createAdminClient();
    await admin.from("organizations").update({ cancel_at_period_end: false }).eq("id", org.orgId);
  } catch {
    // The webhook will sync it shortly regardless.
  }

  revalidatePath("/dashboard/payments");
  return { error: null };
}
