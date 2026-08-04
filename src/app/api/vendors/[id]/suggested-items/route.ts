import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: vendorId } = await params;
  const supabase = await createClient();

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data, error } = await supabase
    .from("purchase_line_items")
    .select("item_id, qty, unit_cost, description, purchases!inner(vendor_id, purchase_date)")
    .eq("purchases.vendor_id", vendorId)
    .gte("purchases.purchase_date", sixMonthsAgo.toISOString().slice(0, 10))
    .not("item_id", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const stats = new Map<
    string,
    { item_id: string; description: string; unit_price: number; count: number; lastDate: string }
  >();

  for (const row of data ?? []) {
    const purchaseRow = row.purchases as unknown as { purchase_date: string };
    if (!row.item_id) continue;
    const existing = stats.get(row.item_id);
    if (existing) {
      existing.count += 1;
      if (purchaseRow.purchase_date > existing.lastDate) {
        existing.lastDate = purchaseRow.purchase_date;
        existing.unit_price = row.unit_cost;
      }
    } else {
      stats.set(row.item_id, {
        item_id: row.item_id,
        description: row.description,
        unit_price: row.unit_cost,
        count: 1,
        lastDate: purchaseRow.purchase_date,
      });
    }
  }

  const suggestions = Array.from(stats.values())
    .sort((a, b) => b.count - a.count || (b.lastDate > a.lastDate ? 1 : -1))
    .slice(0, 10);

  return NextResponse.json({ suggestions });
}
