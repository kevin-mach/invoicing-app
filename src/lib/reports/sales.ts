export type SalesRow = {
  customerId: string;
  customerName: string;
  issueDate: string;
  qty: number;
  unitCost: number;
  unitPrice: number;
};

export type SalesBucket = {
  period: string;
  customerName: string;
  revenue: number;
  cost: number;
  profit: number;
};

export type Granularity = "day" | "month" | "year";

function bucketKey(dateStr: string, granularity: Granularity): string {
  if (granularity === "day") return dateStr;
  if (granularity === "month") return dateStr.slice(0, 7);
  return dateStr.slice(0, 4);
}

/** Aggregates raw invoice-line rows into revenue/cost/profit buckets by period and customer. */
export function aggregateSales(rows: SalesRow[], granularity: Granularity): SalesBucket[] {
  const buckets = new Map<string, SalesBucket>();

  for (const row of rows) {
    const period = bucketKey(row.issueDate, granularity);
    const key = `${period}::${row.customerId}`;
    const revenue = row.qty * row.unitPrice;
    const cost = row.qty * row.unitCost;

    const existing = buckets.get(key);
    if (existing) {
      existing.revenue += revenue;
      existing.cost += cost;
      existing.profit += revenue - cost;
    } else {
      buckets.set(key, { period, customerName: row.customerName, revenue, cost, profit: revenue - cost });
    }
  }

  return Array.from(buckets.values()).sort((a, b) => (a.period < b.period ? 1 : -1));
}
