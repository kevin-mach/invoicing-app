"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ScanButton } from "@/components/bookkeeping/scan-button";
import { DateInput } from "@/components/date-input";
import { btnPrimary, FormNote, inputClass, labelClass, rowInputClass, type FormStatus } from "@/components/bookkeeping/ui";
import { VAT_RATES } from "@/lib/bookkeeping/categories";
import { formatGBP, roundMoney, roundQty } from "@/lib/format";
import { matchVendor } from "@/lib/scan/match-items";
import type { ScanExtraction } from "@/lib/scan/extract";
import { createCreditNote, type CreditNoteLineInput } from "../credit-notes-actions";

type Vendor = { id: string; name: string };
type Line = CreditNoteLineInput & { key: string };

const emptyLine = (): Line => ({ key: crypto.randomUUID(), description: "", qty: 1, unitPrice: 0, net: 0, vatRate: 0, vat: 0 });

const emptyFields = (today: string) => ({
  vendorId: "",
  supplierName: "",
  supplierVatNumber: "",
  creditNoteNumber: "",
  creditDate: today,
  originalInvoiceRef: "",
  accountReference: "",
  reason: "",
  notes: "",
});

/** Records a credit note a supplier has sent. Scanning fills every field from the photo; the
 * person checks it and saves. Nothing is saved straight from the scan. */
export function CreditNoteForm({ orgId, today, vendors }: { orgId: string; today: string; vendors: Vendor[] }) {
  const [fields, setFields] = useState(emptyFields(today));
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [file, setFile] = useState<File | null>(null);
  const [printed, setPrinted] = useState<{ net: number | null; vat: number | null; gross: number | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<FormStatus>(null);

  const set = (patch: Partial<typeof fields>) => setFields((f) => ({ ...f, ...patch }));
  const updateLine = (key: string, patch: Partial<Line>) =>
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        // Qty or unit price changed: the net follows. Net or rate changed: the VAT follows.
        if ("qty" in patch || "unitPrice" in patch) next.net = roundMoney(next.qty * next.unitPrice);
        if ("qty" in patch || "unitPrice" in patch || "net" in patch || "vatRate" in patch) next.vat = roundMoney((next.net * next.vatRate) / 100);
        return next;
      })
    );

  const handleScanned = (data: ScanExtraction, scannedFile: File) => {
    if (data.kind !== "credit_note") return;
    setNote(null);
    setFile(scannedFile);
    const vendor = data.supplierName ? matchVendor(data.supplierName, vendors) : null;
    setFields({
      vendorId: vendor?.id ?? "",
      supplierName: vendor?.name ?? data.supplierName ?? "",
      supplierVatNumber: data.supplierVatNumber ?? "",
      creditNoteNumber: data.creditNoteNumber ?? "",
      creditDate: data.date ?? today,
      originalInvoiceRef: data.originalInvoiceRef ?? "",
      accountReference: data.accountReference ?? "",
      reason: data.reason ?? "",
      notes: "",
    });
    if (data.lines.length) setLines(data.lines.map((l) => ({ ...l, key: crypto.randomUUID() })));
    setPrinted({ net: data.netTotal, vat: data.vatTotal, gross: data.grossTotal });
  };

  const net = roundMoney(lines.reduce((s, l) => s + l.net, 0));
  const vat = roundMoney(lines.reduce((s, l) => s + l.vat, 0));
  const gross = roundMoney(net + vat);
  const mismatch = printed?.gross !== null && printed?.gross !== undefined && Math.abs(printed.gross - gross) > 0.02;

  const save = async () => {
    setSaving(true);
    setNote(null);
    let imagePath: string | null = null;
    if (file) {
      const ext = file.name.split(".").pop() || "jpg";
      imagePath = `${orgId}/credit-notes/${crypto.randomUUID()}.${ext}`;
      const { error } = await createClient().storage.from("receipts").upload(imagePath, file);
      if (error) {
        setSaving(false);
        setNote({ ok: false, text: `Couldn't upload the photo: ${error.message}` });
        return;
      }
    }
    const result = await createCreditNote({
      ...fields,
      vendorId: fields.vendorId || null,
      imagePath,
      lines: lines.filter((l) => l.description.trim()).map(({ key: _key, ...rest }) => rest),
    });
    setSaving(false);
    if (result.error) {
      if (imagePath) await createClient().storage.from("receipts").remove([imagePath]);
      setNote({ ok: false, text: result.error });
      return;
    }
    setFields(emptyFields(today));
    setLines([emptyLine()]);
    setFile(null);
    setPrinted(null);
    setNote({ ok: true, text: "Credit note saved." });
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-slate-50">Add a credit note</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Scan the credit note a supplier sent you, check the details, then save.</p>
        </div>
        <ScanButton kind="credit_note" label="Scan a credit note" onExtracted={handleScanned} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className={labelClass}>Supplier</label>
          <select
            value={fields.vendorId}
            onChange={(e) => {
              const v = vendors.find((x) => x.id === e.target.value);
              set({ vendorId: e.target.value, supplierName: v ? v.name : fields.supplierName });
            }}
            className={inputClass}
          >
            <option value="">Not in my supplier list</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          {!fields.vendorId ? (
            <input value={fields.supplierName} onChange={(e) => set({ supplierName: e.target.value })} placeholder="Supplier name" className={inputClass} />
          ) : null}
        </div>
        <div>
          <label className={labelClass}>Credit note number</label>
          <input value={fields.creditNoteNumber} onChange={(e) => set({ creditNoteNumber: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Date</label>
          <DateInput value={fields.creditDate} onChange={(e) => set({ creditDate: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Against invoice / PO</label>
          <input value={fields.originalInvoiceRef} onChange={(e) => set({ originalInvoiceRef: e.target.value })} placeholder="e.g. INV 555524" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Your account ref with them</label>
          <input value={fields.accountReference} onChange={(e) => set({ accountReference: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Supplier VAT number</label>
          <input value={fields.supplierVatNumber} onChange={(e) => set({ supplierVatNumber: e.target.value })} className={inputClass} />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className={labelClass}>Reason</label>
          <input value={fields.reason} onChange={(e) => set({ reason: e.target.value })} placeholder="e.g. Gas cylinder deposits returned" className={inputClass} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="lines w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="w-20 px-3 py-2 text-right font-medium">Qty</th>
              <th className="w-24 px-3 py-2 text-right font-medium">Unit price</th>
              <th className="w-24 px-3 py-2 text-right font-medium">Net</th>
              <th className="w-20 px-3 py-2 text-right font-medium">VAT %</th>
              <th className="w-24 px-3 py-2 text-right font-medium">VAT</th>
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
                <td className="px-3 py-2" data-label="Unit price">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={l.unitPrice}
                    onChange={(e) => updateLine(l.key, { unitPrice: Number(e.target.value) || 0 })}
                    className={`${rowInputClass} w-full text-right`}
                  />
                </td>
                <td className="px-3 py-2" data-label="Net">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={l.net}
                    onChange={(e) => updateLine(l.key, { net: roundMoney(Number(e.target.value) || 0) })}
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
                <td className="px-3 py-2 text-right text-slate-900 dark:text-slate-50" data-label="VAT">
                  {formatGBP(l.vat)}
                </td>
                <td className="px-3 py-2 text-right" data-remove>
                  <button
                    type="button"
                    onClick={() => setLines((prev) => (prev.length > 1 ? prev.filter((x) => x.key !== l.key) : prev))}
                    className="text-slate-400 hover:text-red-600"
                  >
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
          <label className={labelClass}>Notes</label>
          <textarea rows={2} value={fields.notes} onChange={(e) => set({ notes: e.target.value })} className={inputClass} />
          {file ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">The photo will be saved with the credit note.</p> : null}
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
            <span>{formatGBP(gross)}</span>
          </div>
        </div>
      </div>

      {mismatch ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          The lines come to {formatGBP(gross)} but the credit note says {formatGBP(printed?.gross ?? 0)} — check the lines.
        </p>
      ) : null}

      <div>
        <button type="button" disabled={saving} onClick={save} className={btnPrimary}>
          {saving ? "Saving..." : "Save credit note"}
        </button>
        <FormNote note={note} />
      </div>
    </div>
  );
}
