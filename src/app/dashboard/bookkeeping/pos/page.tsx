import { createClient } from "@/lib/supabase/server";
import { requireBookkeeper } from "@/lib/bookkeeping/access";
import { addDays } from "@/lib/bookkeeping/ageing";
import { isProcessorDeposit, settlementCheck } from "@/lib/bookkeeping/pos";
import { toIsoDate } from "@/lib/bookkeeping/period";
import { formatGBP, roundMoney } from "@/lib/format";
import { StatCard } from "@/components/bookkeeping/ui";
import { DeletePosDay, PosImport } from "./pos-import";

export default async function PosPage() {
  const org = await requireBookkeeper();
  if (!org) return null;
  const today = toIsoDate(new Date());
  const since = addDays(today, -60);
  const supabase = await createClient();

  const [{ data }, { data: bank }] = await Promise.all([
    supabase.from("pos_daily_sales").select("*").eq("org_id", org.orgId).gte("sales_date", since).order("sales_date", { ascending: false }).limit(300),
    supabase.from("bank_transactions").select("description, amount, txn_date").eq("org_id", org.orgId).gt("amount", 0).gte("txn_date", since).limit(2000),
  ]);
  const days = data ?? [];

  // Compare card takings up to 3 days ago against processor deposits, so recent takings that
  // haven't settled yet don't look like a shortfall.
  const cutoff = addDays(today, -3);
  const cardTakings = roundMoney(days.filter((d) => d.sales_date <= cutoff).reduce((s, d) => s + d.card_total, 0));
  const deposits = roundMoney((bank ?? []).filter((b) => isProcessorDeposit(b.description)).reduce((s, b) => s + b.amount, 0));
  const check = settlementCheck(cardTakings, deposits);

  const net = roundMoney(days.reduce((s, d) => s + d.net_sales, 0));
  const vat = roundMoney(days.reduce((s, d) => s + d.vat_amount, 0));
  const tips = roundMoney(days.reduce((s, d) => s + d.tips, 0));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Net sales, last 60 days" value={formatGBP(net)} />
        <StatCard label="Output VAT" value={formatGBP(vat)} />
        <StatCard label="Tips" value={formatGBP(tips)} hint="Not counted as sales" />
        <StatCard label="Days on file" value={String(days.length)} />
      </div>

      {cardTakings > 0 ? (
        <div
          className={`rounded-xl border p-4 text-sm ${
            check.short
              ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
              : "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          <p className="font-medium">Card settlement check</p>
          <p className="mt-1">
            POS card takings (to {cutoff}) {formatGBP(cardTakings)} · processor deposits in the bank {formatGBP(deposits)} ·{" "}
            {check.short ? `${formatGBP(check.gap)} not accounted for. Check for missing payouts, fees taken separately, or unimported bank lines.` : "looks in line (fees and timing allowed for)."}
          </p>
        </div>
      ) : null}

      <PosImport />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 text-right font-medium">Net</th>
              <th className="px-4 py-3 text-right font-medium">VAT</th>
              <th className="px-4 py-3 text-right font-medium">Cash</th>
              <th className="px-4 py-3 text-right font-medium">Card</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="whitespace-nowrap px-4 py-3 text-slate-900 dark:text-slate-50">{d.sales_date}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                  {d.source}
                  {d.location !== "Main" ? ` · ${d.location}` : ""}
                </td>
                <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-50">{formatGBP(d.net_sales)}</td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{formatGBP(d.vat_amount)}</td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{formatGBP(d.cash_total)}</td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{formatGBP(d.card_total)}</td>
                <td className="px-4 py-3 text-right">
                  <DeletePosDay id={d.id} label={d.sales_date} />
                </td>
              </tr>
            ))}
            {!days.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No POS sales yet. Upload an export above or connect Square in Connections.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
