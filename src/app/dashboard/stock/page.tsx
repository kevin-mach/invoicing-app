import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { getItemsWithDefaultCost } from "@/lib/supabase/items";
import { getPurchaseSummaries, sumBy } from "@/lib/bookkeeping/data";
import { addDays } from "@/lib/bookkeeping/ageing";
import { toIsoDate } from "@/lib/bookkeeping/period";
import { wasteLabel } from "@/lib/stock";
import { formatGBP, roundMoney } from "@/lib/format";
import { StatCard } from "@/components/bookkeeping/ui";
import { CountActions, DeleteWastageButton, StockCountForm, WastageForm, type StockItem } from "./stock-forms";

const TABS = [
  { key: "overview", label: "Stock levels" },
  { key: "wastage", label: "Wastage" },
  { key: "counts", label: "Stock counts" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; count?: string }>;
}) {
  const org = await getCurrentOrg();
  if (!org) return null;

  const params = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === params.tab) ? (params.tab as Tab) : "overview";
  const today = toIsoDate(new Date());
  const supabase = await createClient();

  const [costs, { data: itemRows }] = await Promise.all([
    getItemsWithDefaultCost(org.orgId),
    supabase
      .from("items")
      .select("id, item_code, name, unit, category, stock_qty")
      .eq("org_id", org.orgId)
      .eq("is_active", true)
      .order("name"),
  ]);
  const costById = new Map(costs.map((c) => [c.id, c.default_cost]));
  const items: StockItem[] = (itemRows ?? []).map((i) => ({
    id: i.id,
    code: i.item_code,
    name: i.name,
    unit: i.unit,
    qty: i.stock_qty,
    cost: costById.get(i.id) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Stock &amp; wastage</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Know what you hold, what it&apos;s worth, and what&apos;s being thrown away or going missing.
        </p>
        <nav className="mt-4 flex gap-1 border-b border-slate-200 dark:border-slate-800">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/dashboard/stock?tab=${t.key}`}
              className={`border-b-2 px-3 py-2 text-sm font-medium ${
                tab === t.key
                  ? "border-slate-900 text-slate-900 dark:border-slate-50 dark:text-slate-50"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>

      {tab === "overview" ? <Overview items={items} /> : null}
      {tab === "wastage" ? <Wastage orgId={org.orgId} items={items} today={today} /> : null}
      {tab === "counts" ? (
        <Counts
          orgId={org.orgId}
          items={items}
          today={today}
          openCount={params.count}
          canDelete={org.role !== "staff"}
          autoSaveScans={org.autoSaveScans}
        />
      ) : null}
    </div>
  );
}

function Overview({ items }: { items: StockItem[] }) {
  const value = roundMoney(items.reduce((s, i) => s + Math.max(0, i.qty) * i.cost, 0));
  const out = items.filter((i) => i.qty <= 0);
  const uncosted = items.filter((i) => i.qty > 0 && i.cost === 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Stock value" value={formatGBP(value)} hint="On-hand × last paid cost" />
        <StatCard label="Items tracked" value={String(items.length)} />
        <StatCard label="Out of stock" value={String(out.length)} tone={out.length ? "warn" : undefined} />
        <StatCard label="No cost on record" value={String(uncosted.length)} hint="Not valued until you buy them" />
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 text-right font-medium">On hand</th>
              <th className="px-4 py-3 text-right font-medium">Unit cost</th>
              <th className="px-4 py-3 text-right font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="px-4 py-3 text-slate-900 dark:text-slate-50">
                  {i.code ? <span className="text-slate-400">{i.code} · </span> : null}
                  {i.name}
                </td>
                <td className={`px-4 py-3 text-right ${i.qty <= 0 ? "text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-400"}`}>
                  {i.qty} {i.unit}
                </td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{i.cost ? formatGBP(i.cost) : "—"}</td>
                <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-50">
                  {formatGBP(roundMoney(Math.max(0, i.qty) * i.cost))}
                </td>
              </tr>
            ))}
            {!items.length ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  No items yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function Wastage({ orgId, items, today }: { orgId: string; items: StockItem[]; today: string }) {
  const supabase = await createClient();
  const since60 = addDays(today, -60);
  const since30 = addDays(today, -30);

  const [{ data: logs }, purchases] = await Promise.all([
    supabase
      .from("wastage_logs")
      .select("id, item_name, unit, qty, cost, reason, logged_on, notes")
      .eq("org_id", orgId)
      .gte("logged_on", since60)
      .order("logged_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500),
    getPurchaseSummaries(orgId, { since: since30 }),
  ]);

  const all = logs ?? [];
  const last30 = all.filter((l) => l.logged_on >= since30);
  const prior30 = all.filter((l) => l.logged_on < since30);
  const cost30 = roundMoney(last30.reduce((s, l) => s + (l.cost ?? 0), 0));
  const costPrior = roundMoney(prior30.reduce((s, l) => s + (l.cost ?? 0), 0));
  const bought30 = sumBy(purchases, (p) => p.net);

  const byReason = new Map<string, number>();
  const byItem = new Map<string, number>();
  for (const l of last30) {
    byReason.set(l.reason, roundMoney((byReason.get(l.reason) ?? 0) + (l.cost ?? 0)));
    byItem.set(l.item_name, roundMoney((byItem.get(l.item_name) ?? 0) + (l.cost ?? 0)));
  }
  const reasons = [...byReason.entries()].sort((a, b) => b[1] - a[1]);
  const topItems = [...byItem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div className="space-y-4">
      <WastageForm items={items} today={today} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Wasted, last 30 days" value={formatGBP(cost30)} hint={`${last30.length} entr${last30.length === 1 ? "y" : "ies"}`} />
        <StatCard
          label="Previous 30 days"
          value={formatGBP(costPrior)}
          hint={costPrior > 0 ? `${cost30 >= costPrior ? "Up" : "Down"} ${Math.abs(Math.round(((cost30 - costPrior) / costPrior) * 100))}%` : undefined}
        />
        <StatCard
          label="Waste as % of purchases"
          value={bought30 > 0 ? `${((cost30 / bought30) * 100).toFixed(1)}%` : "—"}
          hint={`Against ${formatGBP(bought30)} bought`}
        />
        <StatCard label="Top reason" value={reasons[0] ? wasteLabel(reasons[0][0]) : "—"} hint={reasons[0] ? formatGBP(reasons[0][1]) : undefined} />
      </div>

      {reasons.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <ListCard title="By reason" rows={reasons.map(([k, v]) => [wasteLabel(k), v])} />
          <ListCard title="Most wasted items" rows={topItems} />
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium">Reason</th>
              <th className="px-4 py-3 text-right font-medium">Qty</th>
              <th className="px-4 py-3 text-right font-medium">Cost</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {all.map((l) => (
              <tr key={l.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-400">{l.logged_on}</td>
                <td className="px-4 py-3">
                  <p className="text-slate-900 dark:text-slate-50">{l.item_name}</p>
                  {l.notes ? <p className="text-xs text-slate-500 dark:text-slate-400">{l.notes}</p> : null}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{wasteLabel(l.reason)}</td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                  {l.qty} {l.unit}
                </td>
                <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-50">{formatGBP(l.cost ?? 0)}</td>
                <td className="px-4 py-3 text-right">
                  <DeleteWastageButton id={l.id} label={l.item_name} />
                </td>
              </tr>
            ))}
            {!all.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Nothing logged in the last 60 days.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ListCard({ title, rows }: { title: string; rows: (string | number)[][] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="font-semibold text-slate-900 dark:text-slate-50">{title}</h3>
      <ul className="mt-2 space-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <li key={String(label)} className="flex justify-between gap-3">
            <span className="text-slate-600 dark:text-slate-400">{label}</span>
            <span className="font-medium text-slate-900 dark:text-slate-50">{formatGBP(Number(value))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function Counts({
  orgId,
  items,
  today,
  openCount,
  canDelete,
  autoSaveScans,
}: {
  orgId: string;
  items: StockItem[];
  today: string;
  openCount?: string;
  canDelete: boolean;
  autoSaveScans: boolean;
}) {
  const supabase = await createClient();
  const { data: counts } = await supabase
    .from("stock_counts")
    .select("id, counted_on, notes, applied, stock_count_lines(variance_qty, variance_value)")
    .eq("org_id", orgId)
    .order("counted_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);

  const { data: openLines } = openCount
    ? await supabase
        .from("stock_count_lines")
        .select("id, item_name, unit, system_qty, counted_qty, variance_qty, variance_value")
        .eq("count_id", openCount)
        .order("item_name")
    : { data: null };

  return (
    <div className="space-y-4">
      <StockCountForm items={items} today={today} autoSaveScans={autoSaveScans} />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Counted on</th>
              <th className="px-4 py-3 text-right font-medium">Items</th>
              <th className="px-4 py-3 text-right font-medium">Value difference</th>
              <th className="px-4 py-3 font-medium">Stock levels</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(counts ?? []).map((c) => {
              const lines = (c.stock_count_lines ?? []) as { variance_qty: number | null; variance_value: number | null }[];
              const value = roundMoney(lines.reduce((s, l) => s + (l.variance_value ?? 0), 0));
              return (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/stock?tab=counts&count=${c.id}`} className="font-medium text-slate-900 hover:underline dark:text-slate-50">
                      {c.counted_on}
                    </Link>
                    {c.notes ? <p className="text-xs text-slate-500 dark:text-slate-400">{c.notes}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{lines.length}</td>
                  <td className={`px-4 py-3 text-right font-medium ${value < 0 ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-slate-50"}`}>
                    {formatGBP(value)}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{c.applied ? "Updated" : "Not applied"}</td>
                  <td className="px-4 py-3 text-right">
                    <CountActions id={c.id} applied={c.applied} canDelete={canDelete} />
                  </td>
                </tr>
              );
            })}
            {!counts?.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No stock counts yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {openLines?.length ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <h3 className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
            Count details
          </h3>
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">Item</th>
                <th className="px-4 py-2 text-right font-medium">System</th>
                <th className="px-4 py-2 text-right font-medium">Counted</th>
                <th className="px-4 py-2 text-right font-medium">Difference</th>
                <th className="px-4 py-2 text-right font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {openLines.map((l) => (
                <tr key={l.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2 text-slate-900 dark:text-slate-50">{l.item_name}</td>
                  <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{l.system_qty} {l.unit}</td>
                  <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{l.counted_qty} {l.unit}</td>
                  <td className={`px-4 py-2 text-right ${(l.variance_qty ?? 0) < 0 ? "text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-400"}`}>
                    {(l.variance_qty ?? 0) > 0 ? "+" : ""}
                    {l.variance_qty}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-900 dark:text-slate-50">{formatGBP(l.variance_value ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
