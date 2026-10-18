import { AlertTriangle } from "lucide-react";
import { requireBookkeeper } from "@/lib/bookkeeping/access";
import { resolvePeriod } from "@/lib/bookkeeping/period";
import { computeVatWorksheet } from "@/lib/bookkeeping/vat-return";
import type { VatRow } from "@/lib/bookkeeping/vat";
import { formatGBP } from "@/lib/format";
import { PeriodFilter } from "@/components/bookkeeping/period-filter";
import { VatSettings } from "./vat-settings";

function RateTable({ title, rows, empty }: { title: string; rows: VatRow[]; empty: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <h3 className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
        {title}
      </h3>
      <table className="w-full text-left text-sm">
        <thead className="text-slate-500 dark:text-slate-400">
          <tr>
            <th className="px-4 py-2 font-medium">VAT rate</th>
            <th className="px-4 py-2 text-right font-medium">Net</th>
            <th className="px-4 py-2 text-right font-medium">VAT</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.rate} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-4 py-2 text-slate-900 dark:text-slate-50">{r.rate === 0 ? "0% / zero-rated" : `${r.rate}%`}</td>
              <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{formatGBP(r.net)}</td>
              <td className="px-4 py-2 text-right font-medium text-slate-900 dark:text-slate-50">{formatGBP(r.vat)}</td>
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                {empty}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export default async function VatPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const org = await requireBookkeeper();
  if (!org) return null;

  const params = await searchParams;
  const { from, to } = resolvePeriod(params.from, params.to, "this-quarter");

  const { sales, posSales, purchases, expenses: expenseRows, box, invoiceLines } = await computeVatWorksheet(org.orgId, from, to);

  // Invoices in this period that carry VAT but don't add it to what the customer is asked to pay.
  const vatInvoices = new Map<string, boolean>();
  for (const l of invoiceLines) if (l.vat > 0) vatInvoices.set(l.invoiceId, l.vatOnTop);
  const notAddedCount = [...vatInvoices.values()].filter((onTop) => !onTop).length;

  const boxes: { n: string; label: string; value: number }[] = [
    { n: "1", label: "VAT due on sales", value: box.box1 },
    { n: "4", label: "VAT reclaimed on purchases and expenses", value: box.box4 },
    { n: "5", label: box.box5 >= 0 ? "Net VAT to pay HMRC" : "Net VAT to reclaim from HMRC", value: Math.abs(box.box5) },
    { n: "6", label: "Total sales, excluding VAT", value: box.box6 },
    { n: "7", label: "Total purchases and expenses, excluding VAT", value: box.box7 },
  ];

  return (
    <div className="space-y-6">
      <PeriodFilter basePath="/dashboard/bookkeeping/vat" from={from} to={to} />

      <VatSettings
        addVatToTotal={org.addVatToTotal}
        vatNumber={org.vatNumber ?? ""}
        canEdit={org.role === "owner" || org.role === "admin"}
      />

      {notAddedCount > 0 ? (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p>
            <span className="font-medium">
              {notAddedCount} of {vatInvoices.size} invoice{vatInvoices.size === 1 ? "" : "s"} in this period show VAT
              but don&apos;t add it to the total.
            </span>{" "}
            The VAT due figure below still counts that VAT as owed on top of net sales, as invoiced. If you bill
            VAT-inclusive prices, or want VAT added to totals, turn on the setting above for new invoices or tick
            &ldquo;Add VAT to the total&rdquo; on an individual invoice.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {boxes.map((b) => (
          <div key={b.n} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Box {b.n}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-50">{formatGBP(b.value)}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{b.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <RateTable title="Sales (output VAT)" rows={sales} empty="No sent invoices or POS sales in this period." />
        <RateTable title="Supplier bills (input VAT)" rows={purchases} empty="No bills in this period." />
        <RateTable title="Expenses (input VAT)" rows={expenseRows} empty="No expenses in this period." />
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400">
        {posSales.length ? "Sales include POS takings. " : ""}This worksheet feeds the HMRC submission under Connections. It uses invoice dates (standard
        accounting), counts sent and paid invoices only, and includes bills and expenses by their own dates. Cash
        accounting and the flat rate scheme aren&apos;t supported. Bills default to 0% VAT until you set a rate under
        Payables → Edit.
      </p>
    </div>
  );
}
