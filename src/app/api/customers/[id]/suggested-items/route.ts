import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: customerId } = await params;
  const supabase = await createClient();

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data, error } = await supabase
    .from("invoice_line_items")
    .select("item_id, qty, unit_price, description, invoices!inner(customer_id, issue_date)")
    .eq("invoices.customer_id", customerId)
    .gte("invoices.issue_date", sixMonthsAgo.toISOString().slice(0, 10))
    .not("item_id", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const stats = new Map<
    string,
    { item_id: string; description: string; unit_price: number; count: number; lastDate: string }
  >();

  for (const row of data ?? []) {
    const invoiceRow = row.invoices as unknown as { issue_date: string };
    if (!row.item_id) continue;
    const existing = stats.get(row.item_id);
    if (existing) {
      existing.count += 1;
      if (invoiceRow.issue_date > existing.lastDate) {
        existing.lastDate = invoiceRow.issue_date;
        existing.unit_price = row.unit_price;
      }
    } else {
      stats.set(row.item_id, {
        item_id: row.item_id,
        description: row.description,
        unit_price: row.unit_price,
        count: 1,
        lastDate: invoiceRow.issue_date,
      });
    }
  }

  const all = Array.from(stats.values()).sort((a, b) => b.count - a.count || (b.lastDate > a.lastDate ? 1 : -1));
  const suggestions = all.slice(0, 10);

  // Full item_id -> last-paid-price map for this customer, so the invoice form can pre-fill the
  // price this customer was last charged for ANY item, not just the top suggestion pills.
  const prices: Record<string, number> = {};
  for (const s of all) prices[s.item_id] = s.unit_price;

  return NextResponse.json({ suggestions, prices });
}
