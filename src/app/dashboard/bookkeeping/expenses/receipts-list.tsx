import Link from "next/link";
import { formatGBP, roundMoney } from "@/lib/format";
import { DeleteReceiptButton } from "./expense-form";

export type ReceiptLineRow = {
  id: string;
  description: string;
  qty: number;
  net_amount: number;
  vat_rate: number;
  vat_amount: number;
  category: string | null;
  item_group: string | null;
  is_stock: boolean;
};

export type ReceiptRow = {
  id: string;
  merchant: string;
  receipt_date: string;
  payment_method: string;
  net_total: number;
  vat_total: number;
  gross_total: number | null;
  purchase_id: string | null;
  receiptLink: string | null;
  lines: ReceiptLineRow[];
};

/** One receipt's items as a neat table — what was bought, how many, the price, the VAT and the
 * total paid, and where each line went (stock list or expenses) — with the totals underneath. */
export function ReceiptTable({ receipt: r, readOnly = false }: { receipt: ReceiptRow; readOnly?: boolean }) {
  const stockCount = r.lines.filter((l) => l.is_stock).length;
  const gross = r.gross_total ?? roundMoney(r.net_total + r.vat_total);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="lines w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-2 py-2 font-medium">Item</th>
              <th className="px-2 py-2 text-right font-medium">Qty</th>
              <th className="px-2 py-2 text-right font-medium">Price each</th>
              <th className="px-2 py-2 text-right font-medium">Before VAT</th>
              <th className="px-2 py-2 text-right font-medium">VAT %</th>
              <th className="px-2 py-2 text-right font-medium">VAT</th>
              <th className="px-2 py-2 text-right font-medium">Line total (with VAT)</th>
              <th className="px-2 py-2 font-medium">Kind</th>
              <th className="px-2 py-2 font-medium">Went to</th>
            </tr>
          </thead>
          <tbody>
            {r.lines.map((l) => (
              <tr key={l.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="px-2 py-2 text-slate-900 dark:text-slate-50" data-label="Item" data-wide>
                  {l.description}
                </td>
                <td className="px-2 py-2 text-right text-slate-600 dark:text-slate-400" data-label="Qty">
                  {l.qty}
                </td>
                <td className="px-2 py-2 text-right text-slate-600 dark:text-slate-400" data-label="Price each">
                  {formatGBP(roundMoney(l.net_amount / (l.qty || 1)))}
                </td>
                <td className="px-2 py-2 text-right text-slate-600 dark:text-slate-400" data-label="Before VAT">
                  {formatGBP(l.net_amount)}
                </td>
                <td className="px-2 py-2 text-right text-slate-600 dark:text-slate-400" data-label="VAT %">
                  {l.vat_rate}%
                </td>
                <td className="px-2 py-2 text-right text-slate-600 dark:text-slate-400" data-label="VAT">
                  {formatGBP(l.vat_amount)}
                </td>
                <td className="px-2 py-2 text-right font-medium text-slate-900 dark:text-slate-50" data-label="Line total (with VAT)">
                  {formatGBP(roundMoney(l.net_amount + l.vat_amount))}
                </td>
                <td className="px-2 py-2 text-slate-600 dark:text-slate-400" data-label="Kind">
                  {(l.is_stock ? l.item_group : l.category) ?? "—"}
                </td>
                <td className="px-2 py-2 text-slate-600 dark:text-slate-400" data-label="Went to">
                  {l.is_stock ? "Stock list" : "Expenses"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          {r.receiptLink ? (
            <a href={r.receiptLink} target="_blank" rel="noreferrer" className="underline">
              See the photo
            </a>
          ) : null}
          {r.purchase_id && !readOnly ? (
            <Link href={`/dashboard/purchases/${r.purchase_id}`} className="underline">
              {stockCount} stock item{stockCount === 1 ? "" : "s"} — view the purchase
            </Link>
          ) : null}
          {!readOnly ? <DeleteReceiptButton id={r.id} label={r.merchant} /> : null}
        </div>
        <div className="w-full max-w-xs space-y-1 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-950">
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>Total before VAT</span>
            <span>{formatGBP(r.net_total)}</span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>Total VAT</span>
            <span>{formatGBP(r.vat_total)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
            <span>Total paid</span>
            <span>{formatGBP(gross)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Every scanned receipt as an expandable, itemised table. */
export function ReceiptsList({ receipts, readOnly = false, title = "Scanned receipts" }: { receipts: ReceiptRow[]; readOnly?: boolean; title?: string }) {
  if (!receipts.length) return null;
  return (
    <section className={readOnly ? "" : "rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"}>
      <h2 className={readOnly ? "font-semibold text-slate-900 dark:text-slate-50" : "font-semibold text-slate-900 dark:text-slate-50"}>{title}</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">Tap a receipt to see everything that was on it.</p>
      <div className="mt-3 space-y-2">
        {receipts.map((r) => (
          <details key={r.id} open={readOnly || undefined} className="group rounded-lg border border-slate-200 dark:border-slate-800">
            <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm">
              <span className="font-medium text-slate-900 dark:text-slate-50">{r.merchant}</span>
              <span className="text-slate-500 dark:text-slate-400">{r.receipt_date}</span>
              <span className="capitalize text-slate-500 dark:text-slate-400">{r.payment_method}</span>
              <span className="text-slate-500 dark:text-slate-400">
                {r.lines.length} item{r.lines.length === 1 ? "" : "s"}
              </span>
              <span className="ml-auto font-semibold text-slate-900 dark:text-slate-50">{formatGBP(r.gross_total ?? roundMoney(r.net_total + r.vat_total))}</span>
            </summary>
            <div className="border-t border-slate-200 p-3 dark:border-slate-800">
              <ReceiptTable receipt={r} readOnly={readOnly} />
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
