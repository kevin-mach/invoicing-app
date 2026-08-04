import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TierKey, Cadence } from "@/lib/billing/plans";

async function resolveCadence(stripe: Stripe, subscriptionId: string | undefined): Promise<Cadence> {
  if (!subscriptionId) return "monthly";
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return subscription.items.data[0]?.price.recurring?.interval === "year" ? "yearly" : "monthly";
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.metadata?.org_id;
      const tier = session.metadata?.tier as TierKey | undefined;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

      if (orgId) {
        const cadence = await resolveCadence(stripe, subscriptionId);
        await admin
          .from("organizations")
          .update({
            subscription_status: "active",
            ...(tier ? { subscription_tier: tier } : {}),
            subscription_plan: cadence,
            stripe_customer_id:
              typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null),
            stripe_subscription_id: subscriptionId ?? null,
            cancel_at_period_end: false,
          })
          .eq("id", orgId);
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const orgId = subscription.metadata?.org_id;
      const tier = subscription.metadata?.tier as TierKey | undefined;

      if (orgId) {
        const status = subscription.status === "active" || subscription.status === "trialing" ? "active" : "canceled";
        const cadence: Cadence =
          subscription.items.data[0]?.price.recurring?.interval === "year" ? "yearly" : "monthly";
        const periodEnd = subscription.items.data[0]?.current_period_end;

        await admin
          .from("organizations")
          .update({
            subscription_status: status,
            ...(tier ? { subscription_tier: tier } : {}),
            subscription_plan: cadence,
            stripe_subscription_id: subscription.id,
            cancel_at_period_end: subscription.cancel_at_period_end,
            current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          })
          .eq("id", orgId);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const orgId = subscription.metadata?.org_id;
      if (orgId) {
        await admin
          .from("organizations")
          .update({ subscription_status: "canceled", cancel_at_period_end: false, current_period_end: null })
          .eq("id", orgId);
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
