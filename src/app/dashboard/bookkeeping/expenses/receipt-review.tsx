"use client";

import { Trash2 } from "lucide-react";
import { DateInput } from "@/components/date-input";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, STOCK_GROUPS, VAT_RATES } from "@/lib/bookkeeping/categories";
import { formatGBP, roundMoney, roundQty } from "@/lib/format";
import { btnPrimary, btnSecondary, inputClass, labelClass } from "@/components/bookkeeping/ui";

export type DraftLine = {
  key: string;
  description: string;
  qty: number;
  net: number;
  vatRate: number;
  vat: number;
  category: string;
  itemGroup: string | null;
  isStock: boolean;
  itemId: string | null;
};

export type ReceiptDraft = {
  merchant: string;
  date: string;
  method: string;
  lines: DraftLine[];
  warnings: string[];
  notices: string[];
  /** The total the receipt itself printed, for comparison. */
  printedGross: number | null;
  /** Whether the printed item prices include VAT (true), are before VAT (false), or the receipt has no VAT (null). */
  includesVat: boolean | null;
};

const cell = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50";

/** Every line of a scanned receipt as a neat table — item, quantity, price, VAT and total paid — for
 * the person to check (and correct) before it's saved. */
export function ReceiptReview({
  draft,
  onChange,
  onSave,
  onDiscard,
  saving,
  error,
  supplierNote,
}: {
  draft: ReceiptDraft;
  onChange: (next: ReceiptDraft) => void;
  onSave: () => void;
  onDiscard: () => void;
  saving: boolean;
  error: string | null;
  supplierNote: string | null;
}) {
  const setLine = (key: string, patch: Partial<DraftLine>) =>
    onChange({
      ...draft,
      lines: draft.lines.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        // Changing the amount or rate re-works the VAT for that line.
        if ("net" in patch || "vatRate" in patch) next.vat = roundMoney((next.net * next.vatRate) / 100);
        // Ticking Stock gives the line a stock group if it hasn't got one.
        if ("isStock" in patch && next.isStock && !next.itemGroup) next.itemGroup = "Other";
        return next;
      }),
    });

  /** Re-reads every line's printed price the other way round: as before VAT, or as including VAT. */
  const setPricesIncludeVat = (includes: boolean) => {
    if (draft.includesVat === includes) return;
    onChange({
      ...draft,
      includesVat: includes,
      lines: draft.lines.map((l) => {
        const printed = draft.includesVat === true ? roundMoney(l.net + l.vat) : l.net;
        if (includes) {
          const netValue = roundMoney(printed / (1 + l.vatRate / 100));
          return { ...l, net: netValue, vat: roundMoney(printed - netValue) };
        }
        return { ...l, net: printed, vat: roundMoney((printed * l.vatRate) / 100) };
      }),
    });
  };

  const net = roundMoney(draft.lines.reduce((s, l) => s + l.net, 0));
  const vat = roundMoney(draft.lines.reduce((s, l) => s + l.vat, 0));
  const gross = roundMoney(net + vat);
  const mismatch = draft.printedGross !== null && Math.abs(gross - draft.printedGross) > 0.02;
  const stockCount = draft.lines.filter((l) => l.isStock).length;

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h2 className="font-semibold text-slate-900 dark:text-slate-50">Check this receipt</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Here is everything that was read from the photo. Fix anything that&apos;s wrong, then save. Things you tick as <em>Stock</em> (food, drink,
          ingredients) go into your stock list under the shop as a supplier. Everything else is saved as an expense.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={labelClass}>From</label>
          <input value={draft.merchant} onChange={(e) => onChange({ ...draft, merchant: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Date</label>
          <DateInput value={draft.date} onChange={(e) => onChange({ ...draft, date: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Paid by</label>
          <select value={draft.method} onChange={(e) => onChange({ ...draft, method: e.target.value })} className={`${inputClass} capitalize`}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {supplierNote ? <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-400">{supplierNote}</p> : null}

      {draft.includesVat !== null ? (
        <div>
          <p className={labelClass}>The prices printed on the receipt are…</p>
          <div className="mt-1 inline-flex w-full overflow-hidden rounded-lg border border-slate-300 sm:w-auto dark:border-slate-700" role="group" aria-label="Do the printed prices include VAT?">
            {([false, true] as const).map((v) => (
              <button
                key={String(v)}
                type="button"
                aria-pressed={draft.includesVat === v}
                onClick={() => setPricesIncludeVat(v)}
                className={`min-h-11 flex-1 px-4 py-2 text-sm font-medium sm:flex-none ${
                  draft.includesVat === v
                    ? "bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900"
                    : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {v ? "Including VAT" : "Before VAT"}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            The app works this out from the receipt&apos;s own totals. Only change it if you can see it&apos;s wrong — the box under the table shows whether the total still matches the receipt.
          </p>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="lines w-full min-w-[1040px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="w-16 px-3 py-2 text-right font-medium">Qty</th>
              <th className="w-24 px-3 py-2 text-right font-medium">Price each</th>
              <th className="w-28 px-3 py-2 text-right font-medium">Before VAT</th>
              <th className="w-20 px-3 py-2 font-medium">VAT %</th>
              <th className="w-20 px-3 py-2 text-right font-medium">VAT</th>
              <th className="w-24 px-3 py-2 text-right font-medium">Total paid</th>
              <th className="w-48 px-3 py-2 font-medium">Kind</th>
              <th className="w-16 px-3 py-2 text-center font-medium">Stock</th>
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {draft.lines.map((l) => (
              <tr key={l.key} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="px-3 py-2" data-label="Item" data-wide>
                  <input value={l.description} onChange={(e) => setLine(l.key, { description: e.target.value })} className={cell} />
                  {l.isStock ? (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{l.itemId ? "Already in your stock list" : "New item — you'll be asked before it's added"}</p>
                  ) : null}
                </td>
                <td className="px-3 py-2" data-label="Quantity">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={l.qty}
                    onChange={(e) => setLine(l.key, { qty: roundQty(Number(e.target.value) || 0) })}
                    className={`${cell} text-right`}
                  />
                </td>
                <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400" data-label="Price each">
                  {formatGBP(roundMoney(l.net / (l.qty || 1)))}
                </td>
                <td className="px-3 py-2" data-label="Before VAT (£)">
                  <input
                    type="number"
                    step="0.01"
                    value={l.net}
                    onChange={(e) => setLine(l.key, { net: Number(e.target.value) || 0 })}
                    className={`${cell} text-right`}
                  />
                </td>
                <td className="px-3 py-2" data-label="VAT %">
                  <select value={l.vatRate} onChange={(e) => setLine(l.key, { vatRate: Number(e.target.value) })} className={cell}>
                    {VAT_RATES.map((r) => (
                      <option key={r} value={r}>
                        {r}%
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400" data-label="VAT">
                  {formatGBP(l.vat)}
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-900 dark:text-slate-50" data-label="Total paid">
                  {formatGBP(roundMoney(l.net + l.vat))}
                </td>
                <td className="px-3 py-2" data-label={l.isStock ? "Stock group" : "Expense category"} data-wide>
                  {l.isStock ? (
                    <select value={l.itemGroup ?? "Other"} onChange={(e) => setLine(l.key, { itemGroup: e.target.value })} className={cell}>
                      {STOCK_GROUPS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select value={l.category} onChange={(e) => setLine(l.key, { category: e.target.value })} className={cell}>
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-3 py-2 text-center" data-label="Stock item?">
                  <input
                    type="checkbox"
                    checked={l.isStock}
                    onChange={(e) => setLine(l.key, { isStock: e.target.checked })}
                    aria-label={`${l.description} is a stock item`}
                    className="h-5 w-5"
                  />
                </td>
                <td className="px-3 py-2 text-right" data-remove>
                  <button
                    type="button"
                    onClick={() => onChange({ ...draft, lines: draft.lines.filter((x) => x.key !== l.key) })}
                    className="text-slate-400 hover:text-red-600"
                    aria-label={`Remove ${l.description}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <div className="w-full max-w-xs space-y-1 rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-800">
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>Total before VAT</span>
            <span>{formatGBP(net)}</span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>Total VAT</span>
            <span>{formatGBP(vat)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
            <span>Total paid</span>
            <span>{formatGBP(gross)}</span>
          </div>
          {draft.printedGross !== null ? (
            <p className={`pt-1 text-xs ${mismatch ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
              {mismatch ? `Receipt says ${formatGBP(draft.printedGross)} — doesn't match.` : `Matches the receipt (${formatGBP(draft.printedGross)}).`}
            </p>
          ) : null}
        </div>
      </div>

      {draft.warnings.map((w) => (
        <p key={w} className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {w}
        </p>
      ))}
      {draft.notices.map((n) => (
        <p key={n} className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-400">
          {n}
        </p>
      ))}
      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p> : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" disabled={saving || !draft.lines.length} onClick={onSave} className={`${btnPrimary} min-h-11 w-full sm:w-auto`}>
          {saving ? "Saving..." : `Save receipt${stockCount ? ` (${stockCount} to stock)` : ""}`}
        </button>
        <button type="button" disabled={saving} onClick={onDiscard} className={`${btnSecondary} min-h-11 w-full sm:w-auto`}>
          Discard
        </button>
      </div>
    </div>
  );
}
