"use client";

import { useMemo, useState } from "react";
import { DateInput } from "@/components/date-input";
import { DENOMINATIONS, cashUpMath, countCash, type Denominations } from "@/lib/cashup";
import { formatGBP } from "@/lib/format";
import { btnPrimary, btnSecondary, FormNote, inputClass, labelClass, type FormStatus } from "@/components/bookkeeping/ui";
import { ScanButton } from "@/components/bookkeeping/scan-button";
import type { ScanExtraction } from "@/lib/scan/extract";
import { deleteCashUp, saveCashUp } from "./actions";

export type PosDay = { cash: number; card: number; other: number };

export function CashUpForm({
  today,
  posByDate,
  autoSaveScans,
}: {
  today: string;
  posByDate: Record<string, PosDay>;
  autoSaveScans: boolean;
}) {
  const [date, setDate] = useState(today);
  const [till, setTill] = useState("Main");
  const [openingFloat, setOpeningFloat] = useState("100");
  const [cashSales, setCashSales] = useState("");
  const [cardSales, setCardSales] = useState("");
  const [otherSales, setOtherSales] = useState("");
  const [paidOuts, setPaidOuts] = useState("0");
  const [counts, setCounts] = useState<Denominations>({});
  const [totalOverride, setTotalOverride] = useState("");
  const [closingFloat, setClosingFloat] = useState("100");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<FormStatus>(null);

  const pos = posByDate[date];
  const counted = countCash(counts) || Number(totalOverride) || 0;
  const math = useMemo(
    () =>
      cashUpMath({
        openingFloat: Number(openingFloat) || 0,
        expectedCashSales: Number(cashSales) || 0,
        paidOuts: Number(paidOuts) || 0,
        countedCash: counted,
        closingFloat: Number(closingFloat) || 0,
      }),
    [openingFloat, cashSales, paidOuts, counted, closingFloat]
  );

  const varianceTone =
    Math.abs(math.variance) < 0.005
      ? "text-green-600 dark:text-green-400"
      : Math.abs(math.variance) <= 5
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

  const usePos = () => {
    if (!pos) return;
    setCashSales(String(pos.cash));
    setCardSales(String(pos.card));
    setOtherSales(String(pos.other));
  };

  const doSave = (denominations: Denominations, countedTotalOverride: string) =>
    saveCashUp({
      cashupDate: date,
      till,
      openingFloat: Number(openingFloat) || 0,
      expectedCashSales: Number(cashSales) || 0,
      cardSales: Number(cardSales) || 0,
      otherSales: Number(otherSales) || 0,
      paidOuts: Number(paidOuts) || 0,
      denominations,
      countedTotalOverride: Number(countedTotalOverride) || 0,
      closingFloat: Number(closingFloat) || 0,
      notes,
    });

  const handleScanned = async (data: ScanExtraction) => {
    if (data.kind !== "till") return;
    const nextCounts = data.denominations ? (data.denominations as Denominations) : {};
    const nextOverride = !data.denominations && data.total !== null ? String(data.total) : "";
    setCounts(nextCounts);
    setTotalOverride(nextOverride);

    // Only auto-save once the day's sales figures are already in — a till photo alone is just
    // the counted-cash half of the record, so scanning it first would otherwise save a cash-up
    // with 0 sales.
    const ready = autoSaveScans && cashSales !== "" && cardSales !== "";
    if (!ready) return;

    setBusy(true);
    setMessage(null);
    const result = await doSave(nextCounts, nextOverride);
    setBusy(false);
    if (result.error) {
      setMessage({ ok: false, text: `Couldn't auto-save — ${result.error} Check the figures below and save manually.` });
      return;
    }
    const scannedMath = cashUpMath({
      openingFloat: Number(openingFloat) || 0,
      expectedCashSales: Number(cashSales) || 0,
      paidOuts: Number(paidOuts) || 0,
      countedCash: countCash(nextCounts) || Number(nextOverride) || 0,
      closingFloat: Number(closingFloat) || 0,
    });
    setMessage({ ok: true, text: `Saved automatically from the photo. Variance ${formatGBP(scannedMath.variance)}, bank ${formatGBP(scannedMath.banked)}.` });
    setCounts({});
    setTotalOverride("");
    setNotes("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await doSave(counts, totalOverride);
    setBusy(false);
    if (result.error) {
      setMessage({ ok: false, text: result.error });
      return;
    }
    setMessage({ ok: true, text: `Saved. Variance ${formatGBP(math.variance)}, bank ${formatGBP(math.banked)}.` });
    setCounts({});
    setTotalOverride("");
    setNotes("");
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <h2 className="font-semibold text-slate-900 dark:text-slate-50">End-of-day cash-up</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Count the till, enter what the system says you took in cash, and see straight away whether you&apos;re over or
        short. Saving again for the same date and till replaces the earlier entry.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={labelClass}>Date</label>
          <DateInput required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Till / location</label>
          <input value={till} onChange={(e) => setTill(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Opening float (£)</label>
          <input type="number" step="0.01" min="0" value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} className={`${inputClass} text-right`} />
        </div>
        <div>
          <label className={labelClass}>Paid out of the till (£)</label>
          <input type="number" step="0.01" min="0" value={paidOuts} onChange={(e) => setPaidOuts(e.target.value)} className={`${inputClass} text-right`} />
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">What the system says you took</p>
          {pos ? (
            <button type="button" onClick={usePos} className={`${btnSecondary} px-2.5 py-1 text-xs`}>
              Fill from POS ({formatGBP(pos.cash)} cash)
            </button>
          ) : null}
        </div>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Cash sales (£)</label>
            <input type="number" step="0.01" min="0" value={cashSales} onChange={(e) => setCashSales(e.target.value)} className={`${inputClass} text-right`} />
          </div>
          <div>
            <label className={labelClass}>Card sales (£)</label>
            <input type="number" step="0.01" min="0" value={cardSales} onChange={(e) => setCardSales(e.target.value)} className={`${inputClass} text-right`} />
          </div>
          <div>
            <label className={labelClass}>Other (vouchers etc.) (£)</label>
            <input type="number" step="0.01" min="0" value={otherSales} onChange={(e) => setOtherSales(e.target.value)} className={`${inputClass} text-right`} />
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Cash counted</p>
          <ScanButton kind="till" label="Scan the till" onExtracted={handleScanned} />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-12">
          {DENOMINATIONS.map((d) => (
            <label key={d.key} className="block text-center text-xs text-slate-600 dark:text-slate-400">
              {d.label}
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={counts[d.key] ?? ""}
                onChange={(e) => setCounts((c) => ({ ...c, [d.key]: Number(e.target.value) || 0 }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-1 py-1.5 text-center text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
              />
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400">Or just enter the counted total (£)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={totalOverride}
              disabled={countCash(counts) > 0}
              onChange={(e) => setTotalOverride(e.target.value)}
              className="mt-1 w-36 rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400">Float left in the till (£)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={closingFloat}
              onChange={(e) => setClosingFloat(e.target.value)}
              className="mt-1 w-36 rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-4 dark:bg-slate-950">
        <div>
          <p className="text-slate-500 dark:text-slate-400">Counted</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">{formatGBP(counted)}</p>
        </div>
        <div>
          <p className="text-slate-500 dark:text-slate-400">Should be in the till</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">{formatGBP(math.expectedInTill)}</p>
        </div>
        <div>
          <p className="text-slate-500 dark:text-slate-400">Variance</p>
          <p className={`text-lg font-semibold ${varianceTone}`}>
            {formatGBP(math.variance)} {Math.abs(math.variance) < 0.005 ? "✓" : math.variance < 0 ? "short" : "over"}
          </p>
        </div>
        <div>
          <p className="text-slate-500 dark:text-slate-400">To bank</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">{counted > 0 ? formatGBP(math.banked) : "—"}</p>
        </div>
      </div>

      <div className="mt-3">
        <label className={labelClass}>Notes (optional)</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. voided order, staff meal" className={inputClass} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? "Saving..." : "Save cash-up"}
        </button>
        <FormNote note={message} className="text-sm" />
      </div>
    </form>
  );
}

export function DeleteCashUpButton({ id, label }: { id: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (!confirm(`Delete the cash-up for ${label}?`)) return;
          setBusy(true);
          const result = await deleteCashUp(id);
          setBusy(false);
          if (result.error) setError(result.error);
        }}
        className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-60"
      >
        Delete
      </button>
      {error ? <span className="ml-2 text-xs text-red-600">{error}</span> : null}
    </span>
  );
}
