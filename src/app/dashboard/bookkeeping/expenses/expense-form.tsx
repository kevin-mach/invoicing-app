"use client";

import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DateInput } from "@/components/date-input";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, VAT_RATES } from "@/lib/bookkeeping/categories";
import { formatGBP, roundMoney } from "@/lib/format";
import { btnPrimary, btnSecondary, inputClass, labelClass } from "@/components/bookkeeping/ui";
import { ScanButton } from "@/components/bookkeeping/scan-button";
import type { ScanExtraction } from "@/lib/scan/extract";
import { createExpense, deleteExpense } from "../expenses-actions";

export function ExpenseForm({ orgId, today, autoSaveScans }: { orgId: string; today: string; autoSaveScans: boolean }) {
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

  const handleScanned = async (data: ScanExtraction, scannedFile: File) => {
    if (data.kind !== "receipt") return;
    const nextDate = data.date ?? expenseDate;
    const nextPayee = data.payee ?? "";
    const nextCategory = data.category ?? "";
    const nextGross = data.gross;
    const nextVatRate = data.vatRate ?? 0;
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
