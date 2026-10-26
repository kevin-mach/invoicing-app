"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { DateInput } from "@/components/date-input";
import { btnPrimary, btnSecondary, FormNote, inputClass, labelClass, rowInputClass, type FormStatus } from "@/components/bookkeeping/ui";
import { VAT_RATES } from "@/lib/bookkeeping/categories";
import { formatGBP, roundMoney, roundQty } from "@/lib/format";
import { createCustomerCreditNote, getInvoiceLinesForCredit, type CustomerCreditLineInput } from "../customer-credit-notes-actions";

export type CustomerOption = { id: string; name: string };
export type InvoiceOption = { id: string; number: string | null; customerId: string; issueDate: string; total: number };

type Line = CustomerCreditLineInput & { key: string };
const emptyLine = (): Line => ({ key: crypto.randomUUID(), description: "", qty: 1, unitPrice: 0, vatRate: 20 });

/** Raises a credit note to a customer, usually against one of their invoices (its lines can be copied in). */
export function CustomerCreditNoteForm({ today, customers, invoices }: { today: string; customers: CustomerOption[]; invoices: InvoiceOption[] }) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [date, setDate] = useState(today);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<FormStatus>(null);

  const customerInvoices = invoices.filter((i) => i.customerId === customerId);
  const updateLine = (key: string, patch: Partial<Line>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const lineNet = (l: Line) => roundMoney(l.qty * l.unitPrice);
  const net = roundMoney(lines.reduce((s, l) => s + lineNet(l), 0));
  const vat = roundMoney(lines.reduce((s, l) => s + roundMoney((lineNet(l) * l.vatRate) / 100), 0));

  const copyFromInvoice = async () => {
    if (!invoiceId) return;
    setNote(null);
    const r = await getInvoiceLinesForCredit(invoiceId);
    if (r.error || !r.lines) return setNote({ ok: false, text: r.error ?? "Couldn't read the invoice." });
    setLines(r.lines.length ? r.lines.map((l) => ({ ...l, key: crypto.randomUUID() })) : [emptyLine()]);
    setNote({ ok: true, text: "Lines copied — remove or reduce any that aren't being credited." });
  };

  const save = async () => {
    setBusy(true);
    setNote(null);
    const r = await createCustomerCreditNote({
      customerId,
      invoiceId: invoiceId || null,
      date,
      reason,
      notes,
      lines: lines.filter((l) => l.description.trim()).map(({ key: _key, ...rest }) => rest),
    });
    setBusy(false);
    if (r.error) return setNote({ ok: false, text: r.error });
    setCustomerId("");
    setInvoiceId("");
    setReason("");
    setNotes("");
    setLines([emptyLine()]);
    setNote({ ok: true, text: "Credit note saved." });
    if (r.id) router.push(`/dashboard/bookkeeping/credit-notes/customer/${r.id}`);
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h2 className="font-semibold text-slate-900 dark:text-slate-50">Give a customer a credit note</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">For goods returned, a refund or a mistake on an invoice. Its VAT comes off the VAT you owe on sales.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={labelClass}>Customer</label>
          <select
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              setInvoiceId("");
            }}
            className={inputClass}
          >
            <option value="">Pick a customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Against invoice</label>
          <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} disabled={!customerId} className={inputClass}>
            <option value="">Not against an invoice</option>
            {customerInvoices.map((i) => (
              <option key={i.id} value={i.id}>
                {i.number ?? i.id.slice(0, 8)} · {i.issueDate} · {formatGBP(i.total)}
              </option>
            ))}
          </select>
          {invoiceId ? (
            <button type="button" onClick={copyFromInvoice} className={`mt-2 ${btnSecondary}`}>
              Copy lines from the invoice
            </button>
          ) : null}
        </div>
        <div>
          <label className={labelClass}>Date</label>
          <DateInput value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Reason</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. 2 cases returned damaged" className={inputClass} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="lines w-full min-w-[600px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="w-20 px-3 py-2 text-right font-medium">Qty</th>
              <th className="w-28 px-3 py-2 text-right font-medium">Price ex VAT</th>
              <th className="w-20 px-3 py-2 text-right font-medium">VAT %</th>
              <th className="w-24 px-3 py-2 text-right font-medium">Net</th>
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.key} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="px-3 py-2" data-label="Description" data-wide>
                  <input value={l.description} onChange={(e) => updateLine(l.key, { description: e.target.value })} className={`${rowInputClass} w-full`} />
                </td>
                <td className="px-3 py-2" data-label="Qty">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={l.qty}
                    onChange={(e) => updateLine(l.key, { qty: roundQty(Number(e.target.value) || 0) })}
                    className={`${rowInputClass} w-full text-right`}
                  />
                </td>
                <td className="px-3 py-2" data-label="Price ex VAT">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={l.unitPrice}
                    onChange={(e) => updateLine(l.key, { unitPrice: Number(e.target.value) || 0 })}
                    className={`${rowInputClass} w-full text-right`}
                  />
                </td>
                <td className="px-3 py-2" data-label="VAT %">
                  <select value={l.vatRate} onChange={(e) => updateLine(l.key, { vatRate: Number(e.target.value) })} className={`${rowInputClass} w-full text-right`}>
                    {VAT_RATES.map((r) => (
                      <option key={r} value={r}>
                        {r}%
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-right text-slate-900 dark:text-slate-50" data-label="Net">
                  {formatGBP(lineNet(l))}
                </td>
                <td className="px-3 py-2 text-right" data-remove>
                  <button type="button" onClick={() => setLines((prev) => (prev.length > 1 ? prev.filter((x) => x.key !== l.key) : prev))} className="text-slate-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          onClick={() => setLines((prev) => [...prev, emptyLine()])}
          className="flex items-center gap-1 border-t border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Plus size={16} /> Add line
        </button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <label className={labelClass}>Notes (printed on the credit note)</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
        </div>
        <div className="w-full max-w-xs space-y-1 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>Net</span>
            <span>{formatGBP(net)}</span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>VAT</span>
            <span>{formatGBP(vat)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
            <span>Credit total</span>
            <span>{formatGBP(roundMoney(net + vat))}</span>
          </div>
        </div>
      </div>

      <div>
        <button type="button" disabled={busy || !customerId} onClick={save} className={btnPrimary}>
          {busy ? "Saving..." : "Save credit note"}
        </button>
        <FormNote note={note} />
      </div>
    </div>
  );
}
