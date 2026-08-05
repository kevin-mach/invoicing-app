import { formatGBP } from "@/lib/format";

type LineItem = {
  id: string;
  description: string;
  qty: number;
  unit_price: number;
  line_total: number | null;
};

export function PrintableQuote({
  orgName,
  issueDate,
  recipientName,
  recipientContact,
  lineItems,
  total,
  notes,
}: {
  orgName: string;
  issueDate: string;
  recipientName: string;
  recipientContact: string | null;
  lineItems: LineItem[];
  total: number;
  notes: string | null;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 print:border-0 print:p-0 dark:border-slate-800 dark:bg-slate-900 print:dark:bg-white">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 print:text-black">{orgName}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 print:text-black">Price quote</p>
        </div>
        <span className="rounded px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 print:border print:border-black">
          {issueDate}
        </span>
      </div>

      <div className="mt-6 text-sm">
        <p className="font-medium text-slate-700 dark:text-slate-300 print:text-black">Prepared for</p>
        <p className="text-slate-600 dark:text-slate-400 print:text-black">{recipientName}</p>
        {recipientContact ? (
          <p className="text-slate-600 dark:text-slate-400 print:text-black">{recipientContact}</p>
        ) : null}
      </div>

      <table className="mt-6 w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400 print:text-black">
          <tr>
            <th className="py-2 font-medium">Description</th>
            <th className="py-2 text-right font-medium">Qty</th>
            <th className="py-2 text-right font-medium">Price</th>
            <th className="py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((li) => (
            <tr key={li.id} className="border-b border-slate-100 dark:border-slate-800 print:text-black">
              <td className="py-2">{li.description}</td>
              <td className="py-2 text-right">{li.qty}</td>
              <td className="py-2 text-right">{formatGBP(li.unit_price)}</td>
              <td className="py-2 text-right">{formatGBP(li.line_total ?? li.qty * li.unit_price)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <div className="w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50 print:text-black">
            <span>Total</span>
            <span>{formatGBP(total)}</span>
          </div>
        </div>
      </div>

      {notes ? (
        <p className="mt-4 border-t border-slate-200 pt-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400 print:text-black">
          {notes}
        </p>
      ) : null}

      <p className="mt-4 text-xs text-slate-400 print:text-black">
        This is a price quote, not an invoice — prices are subject to change and this does not create a payment obligation.
      </p>
    </div>
  );
}
