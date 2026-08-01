import Stripe from "stripe";

let cached: Stripe | null = null;

/** Throws if STRIPE_SECRET_KEY isn't set yet — callers should catch and show a friendly message. */
export function getStripe(): Stripe {
  if (cached) return cached;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");

  cached = new Stripe(key);
  return cached;
}
