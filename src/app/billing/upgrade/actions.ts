"use server";

import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/supabase/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import { TIERS, type TierKey, type Cadence } from "@/lib/billing/plans";

export type CheckoutResult = { error: string | null };

export async function startCheckout(tier: TierKey, cadence: Cadence): Promise<CheckoutResult> {
  const org = await getCurrentOrg();
  if (!org) redirect("/login");

  const priceId = TIERS[tier][cadence].stripePriceId;
  if (!priceId) {
    return { error: "This plan isn't available for checkout yet — pricing is still being set up." };
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return { error: "Payments aren't configured yet — ask the app owner to finish Stripe setup." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200";

  let customerId = org.stripeCustomerId;

  const createCustomer = async () => {
    const customer = await stripe.customers.create({
      email: org.userEmail,
      name: org.orgName,
      metadata: { org_id: org.orgId },
    });
    try {
      const admin = createAdminClient();
      await admin.from("organizations").update({ stripe_customer_id: customer.id }).eq("id", org.orgId);
    } catch {
      // Admin client not configured yet; Checkout can still proceed, the webhook will attach it later.
    }
    return customer.id;
  };

  if (!customerId) {
    customerId = await createCustomer();
  }

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/dashboard?checkout=success`,
      cancel_url: `${siteUrl}/billing/upgrade`,
      metadata: { org_id: org.orgId, tier },
      subscription_data: { metadata: { org_id: org.orgId, tier } },
    });
  } catch (err) {
    // A stored customer ID from a different Stripe mode (test vs. live) shows up as "resource_missing" —
    // self-heal by minting a fresh customer under the current key instead of leaving the org stuck.
    if (err && typeof err === "object" && "code" in err && err.code === "resource_missing") {
      customerId = await createCustomer();
      try {
        session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer: customerId,
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: `${siteUrl}/dashboard?checkout=success`,
          cancel_url: `${siteUrl}/billing/upgrade`,
          metadata: { org_id: org.orgId, tier },
          subscription_data: { metadata: { org_id: org.orgId, tier } },
        });
      } catch (retryErr) {
        return { error: retryErr instanceof Error ? retryErr.message : "Could not start checkout. Try again." };
      }
    } else {
      return { error: err instanceof Error ? err.message : "Could not start checkout. Try again." };
    }
  }

  if (!session.url) {
    return { error: "Could not start checkout. Try again." };
  }

  redirect(session.url);
}
