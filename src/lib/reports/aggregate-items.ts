export type ItemTotal = { key: string; name: string; unit: string; qty: number };

type StopLike = { items: { item_id: string | null; description: string; qty: number; unit: string }[] };

/** Sums quantities for the same item across many customer stops, keyed by catalog item id
 * (falling back to description for custom/off-catalog lines). */
export function aggregateItemTotals(
  stops: StopLike[],
  itemsById: Map<string, { name: string; unit: string }>
): ItemTotal[] {
  const map = new Map<string, ItemTotal>();
  for (const stop of stops) {
    for (const li of stop.items) {
      const key = li.item_id ?? `desc:${li.description}`;
      const catalogItem = li.item_id ? itemsById.get(li.item_id) : undefined;
      const existing = map.get(key);
      if (existing) {
        existing.qty += li.qty;
      } else {
        map.set(key, {
          key,
          name: catalogItem?.name ?? li.description,
          unit: li.unit || catalogItem?.unit || "unit",
          qty: li.qty,
        });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}
