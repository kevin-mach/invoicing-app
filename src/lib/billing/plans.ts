export type Cadence = "monthly" | "yearly";

export const TIERS = {
  starter: {
    key: "starter",
    label: "Starter",
    maxUsers: 5,
    monthly: { price: 100, priceLabel: "£100", stripePriceId: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? "" },
    yearly: { price: 1000, priceLabel: "£1,000", stripePriceId: process.env.STRIPE_PRICE_STARTER_YEARLY ?? "" },
  },
  growth: {
    key: "growth",
    label: "Growth",
    maxUsers: 10,
    monthly: { price: 400, priceLabel: "£400", stripePriceId: process.env.STRIPE_PRICE_GROWTH_MONTHLY ?? "" },
    yearly: { price: 4000, priceLabel: "£4,000", stripePriceId: process.env.STRIPE_PRICE_GROWTH_YEARLY ?? "" },
  },
  scale: {
    key: "scale",
    label: "Scale",
    maxUsers: 50,
    monthly: { price: 1600, priceLabel: "£1,600", stripePriceId: process.env.STRIPE_PRICE_SCALE_MONTHLY ?? "" },
    yearly: { price: 16000, priceLabel: "£16,000", stripePriceId: process.env.STRIPE_PRICE_SCALE_YEARLY ?? "" },
  },
} as const;

export type TierKey = keyof typeof TIERS;

export const YEARLY_SAVINGS_NOTE = "2 months free — save 17% vs. monthly";

/** Seat limit for orgs that haven't picked a tier yet (i.e. still on trial). */
export const DEFAULT_TIER: TierKey = "starter";

export const PLAN_FEATURES = [
  "Unlimited customers, suppliers, and items",
  "Invoicing with editable pricing and item suggestions",
  "Purchases with camera receipt scanning (OCR)",
  "Stock sheet planning and pick-list checklists",
  "Recurring invoice templates",
  "Sales, cost, and profit reporting",
  "Spreadsheet import for your existing data",
  "Every team member sees all of the organisation's invoices, stock sheets, suppliers, customers, and items",
];
