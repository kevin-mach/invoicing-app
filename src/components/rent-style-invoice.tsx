import { formatGBP } from "@/lib/format";
import { propertyStatementAddsUp, type PropertyDetails } from "@/lib/property";

type Line = { id: string; description: string; qty: number; unit_price: number; vat_rate?: number; line_total: number | null; vat_amount?: number | null };

const fmtDate = (d: string | null) => (d ? d.split("-").reverse().join("/") : "");
const ink = "text-slate-900 dark:text-slate-50 print:text-black";
const soft = "text-slate-600 dark:text-slate-400 print:text-black";

/** The layout a property company's invoices use, modelled on a letting agent's invoice: who it is
 * between, the invoice number / our ref / date / location, the managed property, what it is for
 * and the fee (VAT included), the tenancy dates, and the statement of account — rent received less
 * the invoice and expenses paid on the owner's behalf, leaving the balance due. */
export function RentStyleInvoice({
  orgName,
  invoiceNumber,
  status,
  issueDate,
  dueDate,
  customerName,
  customerAddress,
  lineItems,
  subtotal,
  vatTotal,
  notes,
  property: p,
}: {
  orgName: string;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  dueDate: string | null;
  customerName: string;
  customerAddress: string | null;
  lineItems: Line[];
  subtotal: number;
  vatTotal: number;
  notes: string | null;
  property: PropertyDetails;
}) {
  // The invoice's own figures, VAT included, however VAT was entered on the form.
  const feeGross = p.invoiceAmount ?? Math.round((subtotal + vatTotal) * 100) / 100;
  const vatIncluded = p.vatIncluded ?? (vatTotal > 0 ? vatTotal : null);
  const gross = (li: Line) => Math.round(((li.line_total ?? li.qty * li.unit_price) + (li.vat_amount ?? 0)) * 100) / 100;
  const adds = propertyStatementAddsUp(p);
  const hasStatement = p.rentReceived !== null || p.expensesPaid !== null || p.balanceDue !== null;
  const dates: [string, string][] = [
    ["Current rent date:", fmtDate(p.currentRentDate)],
    ["Rent review date:", fmtDate(p.rentReviewDate)],
    ["Discuss with agent date:", fmtDate(p.discussWithAgentDate)],
  ];
  const shownDates = dates.filter(([, v]) => v);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm print:border-0 print:p-0 dark:border-slate-800 dark:bg-slate-900 print:dark:bg-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className={`text-2xl font-semibold ${ink}`}>Invoice</h2>
          {p.vatRegNo ? <p className={`font-medium ${ink}`}>VAT Reg. No. {p.vatRegNo}</p> : null}
        </div>
        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium capitalize text-slate-600 dark:bg-slate-800 dark:text-slate-300 print:border print:border-black print:bg-white print:text-black">
          {status}
        </span>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <p className={`font-medium ${ink}`}>{orgName}</p>
        </div>
        <div className="sm:text-right">
          <p className={`font-semibold ${ink}`}>{customerName}</p>
          {customerAddress ? <p className={`whitespace-pre-line ${soft}`}>{customerAddress}</p> : null}
        </div>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          {p.property ? (
            <>
              <p className={ink}>Re: Managed Property at:</p>
              <p className={`font-semibold underline ${ink}`}>{p.property}</p>
            </>
          ) : null}
        </div>
        <dl className="grid grid-cols-[auto_auto] justify-end gap-x-6 gap-y-1 sm:text-right">
          <dt className={soft}>Invoice No.:</dt>
          <dd className={ink}>{p.invoiceNo ?? invoiceNumber}</dd>
          {p.ourRef ? (
            <>
              <dt className={soft}>Our Ref.:</dt>
              <dd className={ink}>{p.ourRef}</dd>
            </>
          ) : null}
          <dt className={soft}>Date:</dt>
          <dd className={ink}>{fmtDate(issueDate)}</dd>
          {dueDate ? (
            <>
              <dt className={soft}>Due:</dt>
              <dd className={ink}>{fmtDate(dueDate)}</dd>
            </>
          ) : null}
          {p.location ? (
            <>
              <dt className={`font-semibold ${ink}`}>Location:</dt>
              <dd className={ink}>{p.location}</dd>
            </>
          ) : null}
        </dl>
      </div>

      {p.description ? <p className={`mt-6 text-base ${ink}`}>{p.description}</p> : null}

      <div className="mt-4 grid items-start gap-4 sm:grid-cols-2">
        {shownDates.length ? (
          <div className="rounded border border-slate-400 p-2 print:border-black">
            {shownDates.map(([k, v]) => (
              <div key={k} className={`flex justify-between gap-4 ${ink}`}>
                <span>{k}</span>
                <span>{v}</span>
              </div>
            ))}
          </div>
        ) : (
          <div />
        )}
        <div className="space-y-1 sm:text-right">
          {lineItems.map((li) => (
            <div key={li.id} className={`flex justify-between gap-4 ${ink}`}>
              <span className="text-left">{lineItems.length > 1 || !p.description ? li.description : "Fee"}</span>
              <span className="font-semibold">{formatGBP(gross(li))}</span>
            </div>
          ))}
          {lineItems.length > 1 ? (
            <div className={`flex justify-between gap-4 border-t border-slate-200 pt-1 font-semibold dark:border-slate-800 ${ink}`}>
              <span>Total (VAT included)</span>
              <span>{formatGBP(feeGross)}</span>
            </div>
          ) : null}
        </div>
      </div>

      {vatIncluded !== null ? (
        <div className={`mt-3 flex justify-between gap-4 ${ink}`}>
          <span>included in our fee above is the VAT @ {lineItems[0]?.vat_rate ?? 20}%</span>
          <span>{formatGBP(vatIncluded)}</span>
        </div>
      ) : null}

      {hasStatement ? (
        <div className="mt-8">
          <p className={`text-center font-medium underline ${ink}`}>STATEMENT OF ACCOUNT</p>
          <div className="mx-auto mt-3 max-w-md space-y-1.5">
            {p.rentReceived !== null ? (
              <div className={`flex justify-between ${ink}`}>
                <span>Rent received</span>
                <span>{formatGBP(p.rentReceived)}</span>
              </div>
            ) : null}
            <div className={`flex justify-between ${ink}`}>
              <span>Less our invoice as above</span>
              <span>{formatGBP(feeGross)}</span>
            </div>
            {p.expensesPaid !== null ? (
              <div className={`flex justify-between ${ink}`}>
                <span>Less expenses paid on your behalf</span>
                <span>{formatGBP(p.expensesPaid)}</span>
              </div>
            ) : null}
            {p.balanceDue !== null ? (
              <div className={`flex justify-between border-t border-slate-300 pt-1.5 font-semibold underline-offset-2 dark:border-slate-700 print:border-black ${ink}`}>
                <span>Balance due to you</span>
                <span>{formatGBP(p.balanceDue)}</span>
              </div>
            ) : null}
            {adds === false ? <p className="no-print text-xs text-amber-700 dark:text-amber-400">These figures don&apos;t add up — edit the invoice to check them.</p> : null}
          </div>
        </div>
      ) : null}

      {p.paidToSortCode || p.paidToAccount ? (
        <div className={`mt-6 text-center ${ink}`}>
          <p className="italic">We have paid the above amount to your account</p>
          <p className="mt-1 flex justify-center gap-16">
            <span>{p.paidToSortCode}</span>
            <span>{p.paidToAccount}</span>
          </p>
        </div>
      ) : null}

      {notes ? <p className={`mt-6 border-t border-slate-200 pt-4 dark:border-slate-800 ${soft}`}>{notes}</p> : null}
    </div>
  );
}
