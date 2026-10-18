import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { weekdayOf, weekdayVariancePatterns } from "@/lib/cashup";
import { addDays } from "@/lib/bookkeeping/ageing";
import { toIsoDate } from "@/lib/bookkeeping/period";
import { formatGBP, roundMoney } from "@/lib/format";
import { CashUpForm, DeleteCashUpButton, type PosDay } from "./cashup-form";

export default async function CashUpPage() {
  const org = await getCurrentOrg();
  if (!org) return null;

  const today = toIsoDate(new Date());
  const since = addDays(today, -90);
  const supabase = await createClient();

  const [{ data: cashUps }, { data: pos }] = await Promise.all([
    supabase
      .from("cash_ups")
      .select(
        "id, cashup_date, till, opening_float, expected_cash_sales, card_sales, paid_outs, counted_cash, closing_float, variance, cash_banked, notes, banked_bank_transaction_id"
      )
      .eq("org_id", org.orgId)
      .gte("cashup_date", since)
      .order("cashup_date", { ascending: false })
      .limit(200),
    // POS figures are owner/bookkeeper-only in the database; other roles simply get no prefill.
    supabase
      .from("pos_daily_sales")
      .select("sales_date, cash_total, card_total, other_total")
      .eq("org_id", org.orgId)
      .gte("sales_date", since),
  ]);

  const posByDate: Record<string, PosDay> = {};
  for (const p of pos ?? []) {
    const cur = posByDate[p.sales_date] ?? { cash: 0, card: 0, other: 0 };
    posByDate[p.sales_date] = {
      cash: roundMoney(cur.cash + p.cash_total),
      card: roundMoney(cur.card + p.card_total),
      other: roundMoney(cur.other + p.other_total),
    };
  }

  const rows = cashUps ?? [];
  const patterns = weekdayVariancePatterns(rows);
  const totalVariance = roundMoney(rows.reduce((s, r) => s + (r.variance ?? 0), 0));
  const canDelete = org.role !== "staff";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Cash-up</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Reconcile the till at the end of each day and catch cash going missing early.
        </p>
      </div>

      <CashUpForm today={today} posByDate={posByDate} autoSaveScans={org.autoSaveScans} />

      {patterns.length ? (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Pattern spotted</p>
            <ul className="mt-1 list-disc pl-5">
              {patterns.map((p) => (
                <li key={p.weekday}>
                  {p.weekday}s are usually {formatGBP(Math.abs(p.average))} {p.average < 0 ? "short" : "over"} (
                  {p.count} cash-ups, {formatGBP(p.total)} in total).
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div>
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Last 90 days</h2>
          {rows.length ? (
            <p className={`text-sm ${totalVariance < 0 ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}>
              Net variance {formatGBP(totalVariance)} over {rows.length} cash-up{rows.length === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
        <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Till</th>
                <th className="px-4 py-3 text-right font-medium">Cash sales</th>
                <th className="px-4 py-3 text-right font-medium">Counted</th>
                <th className="px-4 py-3 text-right font-medium">Variance</th>
                <th className="px-4 py-3 text-right font-medium">Banked</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const v = r.variance ?? 0;
                return (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="whitespace-nowrap px-4 py-3">
                      <p className="text-slate-900 dark:text-slate-50">{r.cashup_date}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{weekdayOf(r.cashup_date)}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {r.till}
                      {r.notes ? <p className="text-xs text-slate-500 dark:text-slate-400">{r.notes}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{formatGBP(r.expected_cash_sales)}</td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-50">{formatGBP(r.counted_cash)}</td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        Math.abs(v) < 0.005
                          ? "text-green-600 dark:text-green-400"
                          : Math.abs(v) <= 5
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {formatGBP(v)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-50">
                      {formatGBP(r.cash_banked ?? 0)}
                      {(r.cash_banked ?? 0) > 0 ? (
                        <p className={`text-xs font-normal ${r.banked_bank_transaction_id ? "text-green-600 dark:text-green-400" : "text-slate-400"}`}>
                          {r.banked_bank_transaction_id ? "Banked" : "Not yet banked"}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canDelete ? <DeleteCashUpButton id={r.id} label={r.cashup_date} /> : null}
                    </td>
                  </tr>
                );
              })}
              {!rows.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No cash-ups yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
