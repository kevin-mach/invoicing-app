/** The extra facts a property company's invoices carry: the property being managed, the rent
 * collected, what the agent took out of it and what is left — plus the key tenancy dates. Shared
 * by the supplier-invoice scan (Purchases), the sales invoice form and the printed invoice. */
export type PropertyDetails = {
  /** "Re: Managed Property at" — the address being managed. */
  property: string | null;
  /** The invoice number printed on the document. */
  invoiceNo: string | null;
  ourRef: string | null;
  location: string | null;
  vatRegNo: string | null;
  /** What the invoice is for, e.g. "To agreed management fees for the above property inc VAT". */
  description: string | null;
  currentRentDate: string | null;
  rentReviewDate: string | null;
  discussWithAgentDate: string | null;
  /** Statement of account: rent received, less the invoice, less expenses paid on your behalf = balance due. */
  rentReceived: number | null;
  invoiceAmount: number | null;
  /** The VAT included in the invoice amount, where the invoice says so. */
  vatIncluded: number | null;
  expensesPaid: number | null;
  balanceDue: number | null;
  paidToSortCode: string | null;
  paidToAccount: string | null;
};

export const PROPERTY_TEXT_KEYS = ["property", "invoiceNo", "ourRef", "location", "vatRegNo", "description", "paidToSortCode", "paidToAccount"] as const;
export const PROPERTY_DATE_KEYS = ["currentRentDate", "rentReviewDate", "discussWithAgentDate"] as const;
export const PROPERTY_MONEY_KEYS = ["rentReceived", "invoiceAmount", "vatIncluded", "expensesPaid", "balanceDue"] as const;

export function emptyPropertyDetails(): PropertyDetails {
  return {
    property: null,
    invoiceNo: null,
    ourRef: null,
    location: null,
    vatRegNo: null,
    description: null,
    currentRentDate: null,
    rentReviewDate: null,
    discussWithAgentDate: null,
    rentReceived: null,
    invoiceAmount: null,
    vatIncluded: null,
    expensesPaid: null,
    balanceDue: null,
    paidToSortCode: null,
    paidToAccount: null,
  };
}

/** Whether anything at all is filled in. */
export function hasPropertyDetails(d: PropertyDetails | null | undefined): d is PropertyDetails {
  if (!d) return false;
  return Object.values(d).some((v) => v !== null && v !== "");
}

/** Makes anything — a scan, a form post, a stored row — into a well-formed PropertyDetails (or null if it's empty). */
export function cleanPropertyDetails(raw: unknown): PropertyDetails | null {
  if (typeof raw !== "object" || raw === null) return null;
  const rec = raw as Record<string, unknown>;
  const out = emptyPropertyDetails();
  for (const k of PROPERTY_TEXT_KEYS) {
    const v = typeof rec[k] === "string" ? (rec[k] as string).trim().slice(0, 300) : "";
    out[k] = v || null;
  }
  for (const k of PROPERTY_DATE_KEYS) {
    const v = typeof rec[k] === "string" ? (rec[k] as string).trim() : "";
    out[k] = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  }
  for (const k of PROPERTY_MONEY_KEYS) {
    const v = rec[k];
    const n = v === null || v === undefined || v === "" ? NaN : Number(v);
    out[k] = Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  }
  return hasPropertyDetails(out) ? out : null;
}

/** Does rent received − invoice − expenses equal the balance due? null when there isn't enough to tell. */
export function propertyStatementAddsUp(d: PropertyDetails): boolean | null {
  if (d.rentReceived === null || d.balanceDue === null) return null;
  const left = d.rentReceived - (d.invoiceAmount ?? 0) - (d.expensesPaid ?? 0);
  return Math.abs(left - d.balanceDue) <= 0.02;
}
