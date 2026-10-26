import { STOCK_GROUPS } from "./categories";

/** What kind of business a supplier is. A specialist (a Billingsgate fishmonger, a New Spitalfields
 * veg stand) tells you what everything on its slip is, even when the handwriting doesn't — so its
 * lines take the supplier's category. A supermarket or cash & carry sells everything, so each line
 * is categorised on its own. */
export const SUPPLIER_TYPES = [
  { type: "Fish market / fishmonger", group: "Fish & seafood", item: "fish" },
  { type: "Fruit & veg wholesaler", group: "Fruit & veg", item: "veg" },
  { type: "Butcher / meat wholesaler", group: "Meat & poultry", item: "meat" },
  { type: "Dairy supplier", group: "Dairy & eggs", item: "dairy" },
  { type: "Bakery", group: "Bakery", item: "bakery item" },
  { type: "Drinks supplier", group: "Drinks", item: "drink" },
  { type: "Cash & carry / food wholesaler", group: null, item: null },
  { type: "Supermarket", group: null, item: null },
  { type: "Packaging & catering supplies", group: "Household & packaging", item: "packaging" },
  { type: "DIY & hardware", group: null, item: null },
  { type: "Homeware & furniture", group: null, item: null },
  { type: "Online retailer", group: null, item: null },
  { type: "Clothing", group: null, item: null },
  { type: "Utilities & telecoms", group: null, item: null },
  { type: "Other", group: null, item: null },
] as const satisfies readonly { type: string; group: (typeof STOCK_GROUPS)[number] | null; item: string | null }[];

export type SupplierType = (typeof SUPPLIER_TYPES)[number]["type"];
export const SUPPLIER_TYPE_NAMES: readonly string[] = SUPPLIER_TYPES.map((t) => t.type);

export function isSupplierType(v: unknown): v is SupplierType {
  return typeof v === "string" && SUPPLIER_TYPE_NAMES.includes(v);
}

/** The category every line from this kind of supplier falls under, or null when it sells a mix. */
export function groupForSupplierType(type: string | null | undefined): string | null {
  return SUPPLIER_TYPES.find((t) => t.type === type)?.group ?? null;
}

const UNREADABLE = /^unreadable\b/i;

/** True for a line whose name couldn't be read off the slip ("Unreadable veg"). */
export function isUnreadable(description: string): boolean {
  return UNREADABLE.test(description.trim());
}

/** What to call a line whose handwriting can't be read: what the supplier sells, so a veg stand's
 * scrawl becomes "Unreadable veg" and still lands in Fruit & veg. */
export function unreadableName(supplierType: string | null | undefined): string {
  const item = SUPPLIER_TYPES.find((t) => t.type === supplierType)?.item;
  return `Unreadable ${item ?? "item"}`;
}

// Checked in order; the first match wins. Market names come first because they are printed on
// every slip from that market, whatever the stand is called.
const RULES: [RegExp, SupplierType][] = [
  [/billingsgate|fish|seafood|shellfish|marine foods|fishmonger|oyster|smokehouse/i, "Fish market / fishmonger"],
  [/spitalfields|nine elms|covent garden market|\bveg\b|vegetable|\bproduce\b|fruit|greengrocer/i, "Fruit & veg wholesaler"],
  [/smithfield|butcher|meats?\b|poultry|halal/i, "Butcher / meat wholesaler"],
  [/dairy|creamery|milk/i, "Dairy supplier"],
  [/bakery|bakers?\b|patisserie/i, "Bakery"],
  [/beverage|drinks|wine|brewery|spirits|champers/i, "Drinks supplier"],
  [/costco|booker|bestway|makro|jj food|restaurant wholesale|cash ?& ?carry|wholesale/i, "Cash & carry / food wholesaler"],
  [/tesco|sainsbury|asda|morrisons|waitrose|lidl|aldi|co-?op|iceland|m&s|marks (&|and) spencer/i, "Supermarket"],
  [/packaging|catering supplies|disposables/i, "Packaging & catering supplies"],
  [/trade ?point|b&q|screwfix|toolstation|wickes|homebase|hardware/i, "DIY & hardware"],
  [/ikea|dunelm|furniture/i, "Homeware & furniture"],
  [/amazon|ebay/i, "Online retailer"],
  [/primark|clothing|workwear/i, "Clothing"],
  [/\bsky\b|\bbt\b|virgin media|vodafone|\bo2\b|\bee\b|british gas|edf|octopus|thames water|electric|energy/i, "Utilities & telecoms"],
];

/** A best guess at the supplier's type from its name and address, or null if nothing fits. */
export function guessSupplierType(name: string | null | undefined, address?: string | null): SupplierType | null {
  const text = `${name ?? ""} ${address ?? ""}`;
  if (!text.trim()) return null;
  return RULES.find(([re]) => re.test(text))?.[1] ?? null;
}

export const UNCATEGORISED = "Uncategorised";

/** A group the bookkeeper made (e.g. "Kitchenware", "Cleaning materials"), with words that put a
 * scanned line into it ("bleach", "caustic"). */
export type ProductGroup = { id: string; name: string; keywords: string[] };

/** Every group a line can be put in: the built-in ones, then the bookkeeper's own. */
export function allGroupNames(custom: { name: string }[] = []): string[] {
  return [...STOCK_GROUPS, ...custom.map((g) => g.name).filter((n) => !STOCK_GROUPS.some((s) => s.toLowerCase() === n.toLowerCase()))];
}

/** The bookkeeper's group whose keyword appears in the description, if any. */
export function groupByKeyword(description: string, custom: ProductGroup[] = []): string | null {
  const text = description.toLowerCase();
  for (const g of custom) {
    if (g.keywords.some((k) => k.trim() && new RegExp(`\\b${k.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(text))) return g.name;
  }
  return null;
}

/** The category a purchase line counts under: its own, else its catalogue item's, else what its
 * supplier sells. Lets older purchases (saved before lines had a category) still be grouped. */
export function categoryOfLine(
  lineCategory: string | null | undefined,
  itemCategory: string | null | undefined,
  supplierType: string | null | undefined,
  custom: { name: string }[] = []
): string {
  return normaliseGroup(lineCategory, custom) ?? normaliseGroup(itemCategory, custom) ?? groupForSupplierType(supplierType) ?? UNCATEGORISED;
}

const GROUP_SYNONYMS: Record<string, string> = {
  produce: "Fruit & veg",
  "fresh produce": "Fruit & veg",
  vegetables: "Fruit & veg",
  fruit: "Fruit & veg",
  beverages: "Drinks",
  drink: "Drinks",
  dairy: "Dairy & eggs",
  grocery: "Dry goods & ingredients",
  groceries: "Dry goods & ingredients",
  meat: "Meat & poultry",
  fish: "Fish & seafood",
  seafood: "Fish & seafood",
  packaging: "Household & packaging",
  cleaning: "Household & packaging",
};

/** Maps a free-text item category ("Produce", "Beverages") onto a built-in group or one of the
 * bookkeeper's own, or null. */
export function normaliseGroup(category: string | null | undefined, custom: { name: string }[] = []): string | null {
  const c = (category ?? "").trim();
  if (!c) return null;
  const exact = allGroupNames(custom).find((g) => g.toLowerCase() === c.toLowerCase());
  return exact ?? GROUP_SYNONYMS[c.toLowerCase()] ?? null;
}
