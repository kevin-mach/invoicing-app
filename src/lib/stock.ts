export const WASTE_REASONS = [
  { key: "spoilage", label: "Spoilage / out of date" },
  { key: "prep_waste", label: "Prep waste / trim" },
  { key: "plate_waste", label: "Returned / plate waste" },
  { key: "breakage", label: "Breakage / spillage" },
  { key: "damaged_delivery", label: "Damaged in delivery" },
  { key: "theft_or_loss", label: "Theft / unexplained loss" },
  { key: "other", label: "Other" },
] as const;

export type WasteReason = (typeof WASTE_REASONS)[number]["key"];

export function wasteLabel(key: string): string {
  return WASTE_REASONS.find((r) => r.key === key)?.label ?? key;
}
