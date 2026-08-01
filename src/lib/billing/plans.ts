export const PLANS = {
  monthly: {
    key: "monthly",
    label: "Monthly",
    price: 79,
    priceLabel: "$79",
    cadenceLabel: "/month",
    note: null,
  },
  yearly: {
    key: "yearly",
    label: "Yearly",
    price: 790,
    priceLabel: "$790",
    cadenceLabel: "/year",
    note: "2 months free — save 17% vs. monthly",
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export const PLAN_FEATURES = [
  "Unlimited customers, vendors, and items",
  "Invoicing with editable pricing and item suggestions",
  "Purchases with camera receipt scanning (OCR)",
  "Run planning and pick-list checklists",
  "Recurring invoice templates",
  "Sales, cost, and profit reporting",
  "Spreadsheet import for your existing data",
  "Unlimited team members",
];
