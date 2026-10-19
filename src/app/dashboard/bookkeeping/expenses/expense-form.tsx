"use client";

import { useMemo, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DateInput } from "@/components/date-input";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, VAT_RATES } from "@/lib/bookkeeping/categories";
import { formatGBP, roundMoney } from "@/lib/format";
import { btnPrimary, btnSecondary, inputClass, labelClass } from "@/components/bookkeeping/ui";
import { ScanButton } from "@/components/bookkeeping/scan-button";
import { useNewEntriesPrompt, type ProposedEntry } from "@/components/bookkeeping/use-new-entries";
import type { ScanExtraction } from "@/lib/scan/extract";
import { matchCatalogItemStrict, matchVendor } from "@/lib/scan/match-items";
import { reconcileReceipt } from "@/lib/scan/receipt-math";
import type { ItemOption } from "@/lib/supabase/items";
import { createExpense, deleteExpense, deleteReceipt, saveReceipt } from "../expenses-actions";
import { ReceiptReview, type ReceiptDraft } from "./receipt-review";

type Vendor = { id: string; name: string };

export function ExpenseForm({
  orgId,
  today,
  autoSaveScans,
  vendors,
  items,
}: {
  orgId: string;
  today: string;
  autoSaveScans: boolean;
  vendors: Vendor[];
  items: ItemOption[];
}) {
  const [draft, setDraft] = useState<ReceiptDraft | null>(null);
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [extraVendors, setExtraVendors] = useState<Vendor[]>([]);
  const [extraItems, setExtraItems] = useState<ItemOption[]>([]);
  const { ask, prompt } = useNewEntriesPrompt();
  const allVendors = useMemo(() => [...vendors, ...extraVendors.filter((e) => !vendors.some((v) => v.id === e.id))], [vendors, extraVendors]);
  const catalog = useMemo(() => [...items, ...extraItems.filter((e) => !items.some((i) => i.id === e.id))], [items, extraItems]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [expenseDate, setExpenseDate] = useState(today);
  const [payee, setPayee] = useState("");
  const [category, setCategory] = useState<string>("");
  const [description, setDescription] = useState("");
  const [gross, setGross] = useState("");
  const [vatRate, setVatRate] = useState<number>(0);
  const [method, setMethod] = useState<string>("card");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const grossNum = Number(gross);
  const net = Number.isFinite(grossNum) ? roundMoney(grossNum / (1 + vatRate / 100)) : 0;
  const vat = Number.isFinite(grossNum) ? roundMoney(grossNum - net) : 0;

  const doSubmit = async (fields: {
    expenseDate: string;
    payee: string;
    category: string;
    description: string;
    gross: number;
    vatRate: number;
    method: string;
    file: File | null;
  }) => {
    let receiptPath: string | null = null;
    if (fields.file) {
      const ext = fields.file.name.split(".").pop() || "jpg";
      receiptPath = `${orgId}/expenses/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await createClient().storage.from("receipts").upload(receiptPath, fields.file);
      if (uploadError) return { error: `Couldn't upload the receipt: ${uploadError.message}` };
    }

    return createExpense({
      expenseDate: fields.expenseDate,
      payee: fields.payee,
      category: fields.category,
      description: fields.description,
      gross: fields.gross,
      vatRate: fields.vatRate,
      paymentMethod: fields.method,
      receiptPath,
    });
  };

  const uploadReceipt = async (f: File | null): Promise<{ path: string | null; error: string | null }> => {
    if (!f) return { path: null, error: null };
    const ext = f.name.split(".").pop() || "jpg";
    const path = `${orgId}/expenses/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await createClient().storage.from("receipts").upload(path, f);
    return uploadError ? { path: null, error: `Couldn't upload the receipt: ${uploadError.message}` } : { path, error: null };
  };

  /** Saves the checked-over receipt. New suppliers/items are only created once the person agrees. */
  const saveDraft = async (d: ReceiptDraft, f: File | null) => {
    setDraftError(null);
    setNote(null);
    setDraftSaving(true);
    const stock = d.lines.filter((l) => l.isStock);
    let vendorList = allVendors;
    let catalogList = catalog;
    let supplier = stock.length ? matchVendor(d.merchant, vendorList) : null;

    const proposed = new Map<string, ProposedEntry>();
    if (stock.length && !supplier) {
      proposed.set(`s:${d.merchant}`, { key: `s:${d.merchant}`, kind: "Supplier", label: d.merchant, detail: "Where this stock was bought", supplier: d.merchant });
    }
    for (const l of stock) {
      if (l.itemId || matchCatalogItemStrict(l.description, catalogList) || proposed.has(`i:${l.description}`)) continue;
      proposed.set(`i:${l.description}`, {
        key: `i:${l.description}`,
        kind: "Item",
        label: l.description,
        detail: `${l.itemGroup ?? "Stock"} · ${l.qty} × ${formatGBP(roundMoney(l.net / (l.qty || 1)))} before VAT`,
        item: { name: l.description, unit: "unit", vatRate: l.vatRate, category: l.itemGroup ?? undefined },
      });
    }
    if (proposed.size) {
      const created = await ask([...proposed.values()], {
        skipNote: "Skipping cancels the save — nothing is added. You can untick Stock on a line to record it as a plain expense instead.",
      });
      if (!created) {
        setDraftSaving(false);
        return;
      }
      vendorList = [...vendorList, ...created.suppliers];
      catalogList = [...catalogList, ...created.items];
      setExtraVendors((p) => [...p, ...created.suppliers]);
      setExtraItems((p) => [...p, ...created.items]);
      supplier = stock.length ? matchVendor(d.merchant, vendorList) : null;
    }

    const lines = d.lines.map((l) => ({
      description: l.description,
      qty: l.qty,
      net: l.net,
      vatRate: l.vatRate,
      vat: l.vat,
      category: l.category,
      itemGroup: l.isStock ? l.itemGroup : null,
      isStock: l.isStock,
      itemId: l.isStock ? (l.itemId ?? matchCatalogItemStrict(l.description, catalogList)?.id ?? null) : null,
    }));
    if (lines.some((l) => l.isStock && !l.itemId) || (stock.length && !supplier)) {
      setDraftSaving(false);
      setDraftError("Some stock lines couldn't be added to your stock list or supplier. Add them, or untick Stock on those lines to record them as plain expenses.");
      return;
    }

    const up = await uploadReceipt(f);
    if (up.error) {
      setDraftSaving(false);
      setDraftError(up.error);
      return;
    }
    const result = await saveReceipt({ merchant: d.merchant, date: d.date, paymentMethod: d.method, supplierId: supplier?.id ?? null, receiptPath: up.path, lines });
    setDraftSaving(false);
    if (result.error) {
      setDraftError(result.error);
      return;
    }
    const stockCount = lines.filter((l) => l.isStock).length;
    setNote(
      `Saved ${d.merchant}: ${stockCount ? `${stockCount} stock item${stockCount === 1 ? "" : "s"} added under ${supplier?.name ?? "the supplier"}` : ""}${
        stockCount && result.expenseCount ? " and " : ""
      }${result.expenseCount ? `${result.expenseCount} expense entr${result.expenseCount === 1 ? "y" : "ies"}` : ""}.`
    );
    setDraft(null);
    setDraftFile(null);
  };

  const handleScanned = async (data: ScanExtraction, scannedFile: File) => {
    if (data.kind !== "receipt") return;
    setError(null);
    setNote(null);

    // A receipt with readable lines gets the itemised review; one with only a total falls back to the simple form.
    if (data.lines.length) {
      const rec = reconcileReceipt(data);
      const notices = [...rec.notices];
      if (!data.date) notices.push("The date wasn't readable, so today's date is filled in — check it.");
      const warnings = [...rec.warnings];
      if (!data.payee) warnings.push("The shop name wasn't readable — enter it before saving.");
      const next: ReceiptDraft = {
        merchant: data.payee ?? "",
        date: data.date ?? today,
        method: data.paymentMethod ?? "card",
        printedGross: data.grossTotal,
        warnings,
        notices,
        lines: rec.lines.map((l) => ({
          key: crypto.randomUUID(),
          description: l.description,
          qty: l.qty,
          net: l.net,
          vatRate: l.vatRate,
          vat: l.vat,
          category: l.category ?? data.category ?? "Other",
          itemGroup: l.isStock && l.net >= 0 ? (l.itemGroup ?? "Other") : null,
          // A discount or coupon is never a stock item — it just reduces the stock purchase it belongs to.
          isStock: l.isStock && l.net >= 0,
          itemId: l.isStock && l.net >= 0 ? (matchCatalogItemStrict(l.description, catalog)?.id ?? null) : null,
        })),
      };
      setDraft(next);
      setDraftFile(scannedFile);
      setDraftError(null);
      if (autoSaveScans && warnings.length === 0 && next.merchant.trim()) await saveDraft(next, scannedFile);
      return;
    }

    const nextDate = data.date ?? expenseDate;
    const nextPayee = data.payee ?? "";
    const nextCategory = data.category ?? "";
    const nextGross = data.grossTotal;
    const nextVatRate =
      data.netTotal && data.vatTotal !== null ? ([0, 5, 20].reduce((a, b) => (Math.abs((data.vatTotal! / data.netTotal!) * 100 - b) < Math.abs((data.vatTotal! / data.netTotal!) * 100 - a) ? b : a))) : 0;
    const nextDescription = data.notes ?? "";

    setExpenseDate(nextDate);
    setPayee(nextPayee);
    setCategory(nextCategory);
    if (nextGross !== null) setGross(String(nextGross));
    setVatRate(nextVatRate);
    setDescription(nextDescription);
    setFile(scannedFile); // the scanned photo doubles as the attached receipt on submit

    const ready = autoSaveScans && nextPayee.trim() && nextCategory && nextGross !== null && nextGross !== 0;
    if (!ready) return;

    setBusy(true);
    setNote(null);
    const result = await doSubmit({
      expenseDate: nextDate,
      payee: nextPayee,
      category: nextCategory,
      description: nextDescription,
      gross: nextGross,
      vatRate: nextVatRate,
      method,
      file: scannedFile,
    });
    setBusy(false);
    if (result.error) {
      setError(`Couldn't auto-save — ${result.error} Check the fields below and save manually.`);
      return;
    }
    setNote("Saved automatically from the photo.");
    setPayee("");
    setDescription("");
    setGross("");
    setFile(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNote(null);

    const result = await doSubmit({ expenseDate, payee, category, description, gross: grossNum, vatRate, method, file });
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setPayee("");
    setDescription("");
    setGross("");
    setFile(null);
  };

  if (draft) {
    const stock = draft.lines.some((l) => l.isStock);
    const known = stock ? matchVendor(draft.merchant, allVendors) : null;
    const supplierNote = stock
      ? known
        ? `Stock lines will be recorded as a purchase from ${known.name}, which is already in your suppliers.`
        : `Stock lines will be recorded as a purchase from ${draft.merchant || "this shop"}. It isn't in your suppliers yet — you'll be asked before it's added.`
      : null;
    return (
      <div className="space-y-4">
        {prompt}
        <ReceiptReview
          draft={draft}
          onChange={setDraft}
          onSave={() => void saveDraft(draft, draftFile)}
          onDiscard={() => {
            setDraft(null);
            setDraftFile(null);
            setDraftError(null);
          }}
          saving={draftSaving}
          error={draftError}
          supplierNote={supplierNote}
        />
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-slate-50">Add an expense</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            For costs that aren&apos;t stock from a supplier — fuel, packaging, utilities, insurance and so on.
          </p>
        </div>
        <ScanButton kind="receipt" label="Scan a receipt" onExtracted={handleScanned} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={labelClass}>Date</label>
          <DateInput required value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Paid to</label>
          <input required value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="e.g. Shell" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Category</label>
          <select required value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
            <option value="">Choose…</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Paid by</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={`${inputClass} capitalize`}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Total paid (£)</label>
          <input
            required
            type="number"
            step="0.01"
            value={gross}
            onChange={(e) => setGross(e.target.value)}
            className={`${inputClass} text-right`}
          />
        </div>
        <div>
          <label className={labelClass}>VAT included</label>
          <select value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))} className={inputClass}>
            {VAT_RATES.map((r) => (
              <option key={r} value={r}>
                {r === 0 ? "No VAT" : `${r}%`}
              </option>
            ))}
          </select>
          {grossNum ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {formatGBP(net)} net + {formatGBP(vat)} VAT
            </p>
          ) : null}
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Notes (optional)</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button type="button" onClick={() => fileRef.current?.click()} className={`flex items-center gap-1 ${btnSecondary}`}>
          <Camera size={16} /> {file ? file.name : "Attach receipt"}
        </button>
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? "Saving..." : "Add expense"}
        </button>
      </div>
      {error ? (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>
      ) : null}
      {note ? (
        <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">{note}</p>
      ) : null}
    </form>
  );
}

export function DeleteReceiptButton({ id, label }: { id: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (!confirm(`Delete the receipt from ${label}? Its expenses are removed and any stock it added is taken back out.`)) return;
          setBusy(true);
          setError(null);
          const result = await deleteReceipt(id);
          setBusy(false);
          if (result.error) setError(result.error);
        }}
        className="text-slate-500 underline hover:text-red-600 disabled:opacity-60"
      >
        {busy ? "Deleting..." : "Delete this receipt"}
      </button>
      {error ? <span className="ml-2 text-red-600">{error}</span> : null}
    </span>
  );
}

export function DeleteExpenseButton({ id, label }: { id: string; label: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      aria-label={`Delete ${label}`}
      onClick={async () => {
        if (!confirm(`Delete the expense "${label}"?`)) return;
        setBusy(true);
        await deleteExpense(id);
        setBusy(false);
      }}
      className="text-slate-400 hover:text-red-600 disabled:opacity-60"
    >
      <Trash2 size={16} />
    </button>
  );
}
