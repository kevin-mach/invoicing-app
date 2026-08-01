export const PLANS = {
  monthly: {
    key: "monthly",
    label: "Monthly",
    price: 100,
    priceLabel: "£100",
    cadenceLabel: "/month",
    note: null,
  },
  yearly: {
    key: "yearly",
    label: "Yearly",
    price: 1000,
    priceLabel: "£1,000",
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
