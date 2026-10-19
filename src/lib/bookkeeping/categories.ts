/** Expense categories for costs that aren't stock purchases from a supplier (those live under
 * Purchases and count as cost of goods). Kept as a fixed list rather than a table so reports
 * stay consistent across organisations. */
export const EXPENSE_CATEGORIES = [
  "Fuel",
  "Vehicle running & repairs",
  "Vehicle insurance & tax",
  "Food & drink",
  "Packaging & consumables",
  "Cleaning supplies",
  "Utilities",
  "Rent & rates",
  "Insurance",
  "Wages & subcontractors",
  "Phone, internet & software",
  "Equipment & tools",
  "Repairs & maintenance",
  "Professional fees",
  "Bank & card charges",
  "Marketing",
  "Travel & subsistence",
  "Other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** Groups for things kept in stock — used to categorise new items added from a scanned receipt. */
export const STOCK_GROUPS = [
  "Meat & poultry",
  "Fish & seafood",
  "Fruit & veg",
  "Dairy & eggs",
  "Bakery",
  "Dry goods & ingredients",
  "Sauces & condiments",
  "Drinks",
  "Frozen",
  "Household & packaging",
  "Other",
] as const;

export const PAYMENT_METHODS = ["bank", "card", "cash", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** UK VAT rates offered when entering VAT on a bill or expense. */
export const VAT_RATES = [0, 5, 20] as const;
