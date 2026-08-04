type LineItem = {
  id: string;
  description: string;
  qty: number;
  unit_price: number;
  vat_rate?: number;
  line_total: number | null;
};

export function PrintableInvoice({
  orgName,
  invoiceNumber,
  status,
  issueDate,
  dueDate,
  customerName,
  customerAddress,
  lineItems,
  subtotal,
  tax,
  vatTotal,
  total,
  notes,
}: {
  orgName: string;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  dueDate: string | null;
  customerName: string;
  customerAddress: string | null;
  lineItems: LineItem[];
  subtotal: number;
  tax: number;
  vatTotal: number;
  total: number;
  notes: string | null;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 print:border-0 print:p-0 dark:border-slate-800 dark:bg-slate-900 print:dark:bg-white">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 print:text-black">{orgName}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 print:text-black">Invoice {invoiceNumber}</p>
        </div>
        <span className="rounded px-2 py-1 text-xs font-medium capitalize bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 print:border print:border-black">
          {status}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="font-medium text-slate-700 dark:text-slate-300 print:text-black">Bill to</p>
          <p className="text-slate-600 dark:text-slate-400 print:text-black">{customerName}</p>
          {customerAddress ? <p className="text-slate-600 dark:text-slate-400 print:text-black">{customerAddress}</p> : null}
        </div>
        <div className="text-right">
          <p className="text-slate-600 dark:text-slate-400 print:text-black">Issue date: {issueDate}</p>
          {dueDate ? <p className="text-slate-600 dark:text-slate-400 print:text-black">Due date: {dueDate}</p> : null}
        </div>
      </div>

      <table className="mt-6 w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400 print:text-black">
          <tr>
            <th className="py-2 font-medium">Description</th>
            <th className="py-2 text-right font-medium">Qty</th>
            <th className="py-2 text-right font-medium">Price</th>
            <th className="py-2 text-right font-medium">VAT %</th>
            <th className="py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((li) => (
            <tr key={li.id} className="border-b border-slate-100 dark:border-slate-800 print:text-black">
              <td className="py-2">{li.description}</td>
              <td className="py-2 text-right">{li.qty}</td>
              <td className="py-2 text-right">${li.unit_price.toFixed(2)}</td>
              <td className="py-2 text-right">{li.vat_rate ?? 0}%</td>
              <td className="py-2 text-right">${(li.line_total ?? li.qty * li.unit_price).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <div className="w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between text-slate-600 dark:text-slate-400 print:text-black">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-400 print:text-black">
            <span>VAT</span>
            <span>${vatTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-400 print:text-black">
            <span>Tax</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50 print:text-black">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {notes ? (
        <p className="mt-4 border-t border-slate-200 pt-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400 print:text-black">
          {notes}
        </p>
      ) : null}
    </div>
  );
}
