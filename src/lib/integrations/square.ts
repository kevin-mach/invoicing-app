import { createAdminClient } from "@/lib/supabase/admin";
import { roundMoney } from "@/lib/format";
import { providerConfig } from "./config";
import { apiFetch, getAccessToken, logSync } from "./store";

type Money = { amount?: number };
type Order = {
  location_id: string;
  closed_at?: string;
  total_money?: Money;
  total_tax_money?: Money;
  total_tip_money?: Money;
  total_discount_money?: Money;
  total_service_charge_money?: Money;
  tenders?: { type?: string; amount_money?: Money; tip_money?: Money }[];
  returns?: unknown[];
  refunds?: { amount_money?: Money }[];
};
type Location = { id: string; name?: string; timezone?: string };

const pounds = (m?: Money) => (m?.amount ?? 0) / 100;

function localDate(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** Rebuilds each day's totals from completed orders over a rolling window and replaces them, so a
 * late-closed order or refund is picked up on the next run. Only whole days inside the window are
 * written, so a day is never saved from a partial view of its orders. */
export async function syncSquare(orgId: string): Promise<{ days: number }> {
  const cfg = providerConfig("square");
  try {
    const { token, connection } = await getAccessToken(orgId, "square");
    const auth = { "Square-Version": "2024-10-17" };

    const locs = ((await apiFetch(`${cfg.apiUrl}/v2/locations`, token, { headers: auth })) as { locations?: Location[] }).locations ?? [];
    if (!locs.length) throw new Error("No Square locations found.");
    const tzOf = new Map(locs.map((l) => [l.id, l.timezone ?? "Europe/London"]));
    const nameOf = new Map(locs.map((l) => [l.id, (l.name ?? "Main").slice(0, 80)]));

    const windowDays = connection.last_synced_at ? 7 : 60;
    const fromDate = new Date(Date.now() - windowDays * 86_400_000).toISOString().slice(0, 10);
    const startAt = new Date(new Date(`${fromDate}T00:00:00Z`).getTime() - 86_400_000).toISOString();

    const orders: Order[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 40; page++) {
      const res = (await apiFetch(`${cfg.apiUrl}/v2/orders/search`, token, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          location_ids: locs.map((l) => l.id),
          limit: 500,
          cursor,
          query: {
            filter: { state_filter: { states: ["COMPLETED"] }, date_time_filter: { closed_at: { start_at: startAt } } },
            sort: { sort_field: "CLOSED_AT", sort_order: "ASC" },
          },
        }),
      })) as { orders?: Order[]; cursor?: string };
      orders.push(...(res.orders ?? []));
      cursor = res.cursor;
      if (!cursor) break;
    }
    if (cursor) throw new Error("Too many orders to sync in one go — try again later.");

    const days = new Map<string, { date: string; loc: string; gross: number; net: number; vat: number; cash: number; card: number; other: number; tips: number; refunds: number; discounts: number; service: number; n: number }>();
    for (const o of orders) {
      if (!o.closed_at) continue;
      const date = localDate(o.closed_at, tzOf.get(o.location_id) ?? "Europe/London");
      if (date < fromDate) continue;
      const loc = nameOf.get(o.location_id) ?? "Main";
      const key = `${date}|${loc}`;
      const d = days.get(key) ?? { date, loc, gross: 0, net: 0, vat: 0, cash: 0, card: 0, other: 0, tips: 0, refunds: 0, discounts: 0, service: 0, n: 0 };
      const total = pounds(o.total_money);
      const tip = pounds(o.total_tip_money);
      const tax = pounds(o.total_tax_money);
      d.gross += total - tip;
      d.net += total - tip - tax;
      d.vat += tax;
      d.tips += tip;
      d.discounts += pounds(o.total_discount_money);
      d.service += pounds(o.total_service_charge_money);
      d.refunds += (o.refunds ?? []).reduce((s, r) => s + pounds(r.amount_money), 0);
      d.n += 1;
      for (const t of o.tenders ?? []) {
        const amt = pounds(t.amount_money) - pounds(t.tip_money);
        if (t.type === "CASH") d.cash += amt;
        else if (t.type === "CARD") d.card += amt;
        else d.other += amt;
      }
      days.set(key, d);
    }

    const rows = [...days.values()].map((d) => ({
      org_id: orgId,
      source: "square",
      sales_date: d.date,
      location: d.loc,
      gross_sales: roundMoney(d.gross),
      net_sales: roundMoney(d.net),
      vat_amount: roundMoney(d.vat),
      cash_total: roundMoney(d.cash),
      card_total: roundMoney(d.card),
      other_total: roundMoney(d.other),
      tips: roundMoney(d.tips),
      refunds: roundMoney(d.refunds),
      discounts: roundMoney(d.discounts),
      service_charge: roundMoney(d.service),
      transactions: d.n,
      updated_at: new Date().toISOString(),
    }));
    if (rows.length) {
      const { error } = await createAdminClient().from("pos_daily_sales").upsert(rows, { onConflict: "org_id,source,location,sales_date" });
      if (error) throw new Error(error.message);
    }
    await logSync(orgId, "square", "pos", "ok", rows.length, `${orders.length} order(s) across ${rows.length} day(s)`);
    return { days: rows.length };
  } catch (e) {
    await logSync(orgId, "square", "pos", "error", 0, e instanceof Error ? e.message : "POS sync failed.");
    throw e;
  }
}
