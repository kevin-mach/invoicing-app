"use client";

import { useMemo, useState } from "react";
import { DateInput } from "@/components/date-input";
import { WASTE_REASONS } from "@/lib/stock";
import { formatGBP, roundMoney } from "@/lib/format";
import { btnPrimary, FormNote, inputClass, labelClass, rowBtnSecondary, type FormStatus } from "@/components/bookkeeping/ui";
import { ScanButton } from "@/components/bookkeeping/scan-button";
import type { ScanExtraction } from "@/lib/scan/extract";
import { matchCatalogItem } from "@/lib/scan/match-items";
import { useNewEntriesPrompt, type ProposedEntry } from "@/components/bookkeeping/use-new-entries";
import { applyStockCount, deleteStockCount, deleteWastage, logWastage, saveStockCount } from "./actions";

export type StockItem = { id: string; code: string | null; name: string; unit: string; qty: number; cost: number };

export function WastageForm({ items, today }: { items: StockItem[]; today: string }) {
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState<string>("spoilage");
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<FormStatus>(null);

  const item = items.find((i) => i.id === itemId);
  const cost = item ? roundMoney((Number(qty) || 0) * item.cost) : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await logWastage({ itemId, qty: Number(qty), reason, loggedOn: date, notes });
    setBusy(false);
    if (result.error) {
      setMessage({ ok: false, text: result.error });
      return;
    }
    setMessage({ ok: true, text: `Logged. Stock reduced by ${qty} ${item?.unit ?? ""}.` });
    setQty("");
    setNotes("");
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="font-semibold text-slate-900 dark:text-slate-50">Log wastage</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Anything thrown away, spoiled or lost. It reduces your stock level and is costed at what you last paid.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label className={labelClass}>Item</label>
          <select required value={itemId} onChange={(e) => setItemId(e.target.value)} className={inputClass}>
            <option value="">Choose…</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.code ? `${i.code} — ` : ""}
                {i.name} ({i.qty} {i.unit} in stock)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Quantity{item ? ` (${item.unit})` : ""}</label>
          <input required type="number" step="0.01" min="0.01" value={qty} onChange={(e) => setQty(e.target.value)} className={`${inputClass} text-right`} />
          {item && Number(qty) ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Costs {formatGBP(cost)}</p>
          ) : null}
        </div>
        <div>
          <label className={labelClass}>Reason</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass}>
            {WASTE_REASONS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Date</label>
          <DateInput required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </div>
        <div className="sm:col-span-2 lg:col-span-5">
          <label className={labelClass}>Notes (optional)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? "Saving..." : "Log wastage"}
        </button>
        <FormNote note={message} className="text-sm" />
      </div>
    </form>
  );
}

export function DeleteWastageButton({ id, label }: { id: string; label: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!confirm(`Remove "${label}"? The stock is added back.`)) return;
        setBusy(true);
        await deleteWastage(id);
        setBusy(false);
      }}
      className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-60"
    >
      Remove
    </button>
  );
}

export function StockCountForm({ items: baseItems, today, autoSaveScans }: { items: StockItem[]; today: string; autoSaveScans: boolean }) {
  const [extraItems, setExtraItems] = useState<StockItem[]>([]);
  const items = useMemo(() => [...baseItems, ...extraItems.filter((e) => !baseItems.some((i) => i.id === e.id))], [baseItems, extraItems]);
  const { ask, prompt } = useNewEntriesPrompt();
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [apply, setApply] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<FormStatus>(null);

  const entered = useMemo(() => items.filter((i) => counted[i.id] !== undefined && counted[i.id] !== ""), [items, counted]);
  const variance = useMemo(
    () => roundMoney(entered.reduce((s, i) => s + (Number(counted[i.id]) - i.qty) * i.cost, 0)),
    [entered, counted]
  );

  const doSave = (lines: { itemId: string; countedQty: number }[]) => saveStockCount({ countedOn: date, notes, lines, apply });

  const handleScanned = async (data: ScanExtraction) => {
    if (data.kind !== "list") return;
    let catalogList: StockItem[] = items;

    // Items on the photo that aren't in the catalogue are only added if the person says so.
    const proposed = new Map<string, ProposedEntry>();
    for (const line of data.items) {
      if (matchCatalogItem(line.description, catalogList) || proposed.has(`i:${line.description}`)) continue;
      proposed.set(`i:${line.description}`, {
        key: `i:${line.description}`,
        kind: "Item",
        label: line.description,
        detail: `${line.qty}${line.unit ? ` ${line.unit}` : ""} counted`,
        item: { name: line.description, unit: line.unit ?? "unit" },
      });
    }
    if (proposed.size) {
      const created = await ask([...proposed.values()]);
      if (created) {
        const added: StockItem[] = created.items.map((i) => ({ id: i.id, code: i.item_code, name: i.name, unit: i.unit, qty: 0, cost: 0 }));
        catalogList = [...catalogList, ...added];
        setExtraItems((p) => [...p, ...added]);
      }
    }

    const unmatched: string[] = [];
    const matched: Record<string, string> = {};
    for (const line of data.items) {
      const match = matchCatalogItem(line.description, catalogList);
      if (match) matched[match.id] = String(line.qty);
      else unmatched.push(line.description);
    }
    setCounted((prev) => ({ ...prev, ...matched }));
    const matchedCount = data.items.length - unmatched.length;

    // Only auto-save when every item on the photo is in the catalogue (already, or just added with
    // the person's say-so) — a partial match means guessing at what the rest was.
    const ready = autoSaveScans && unmatched.length === 0 && matchedCount > 0;
    if (!ready) {
      setMessage({
        ok: unmatched.length === 0,
        text: `Filled in ${matchedCount} item${matchedCount === 1 ? "" : "s"} from the photo.${unmatched.length ? ` Didn't recognise: ${unmatched.slice(0, 6).join(", ")}${unmatched.length > 6 ? "…" : ""} — check spelling or add them to your catalogue.` : ""}`,
      });
      return;
    }

    setBusy(true);
    setMessage(null);
    const lines = Object.entries(matched).map(([itemId, qty]) => ({ itemId, countedQty: Number(qty) }));
    const result = await doSave(lines);
    setBusy(false);
    if (result.error) {
      setMessage({ ok: false, text: `Couldn't auto-save — ${result.error} Check the counts below and save manually.` });
      return;
    }
    setMessage({ ok: true, text: `Saved ${lines.length} counted item${lines.length === 1 ? "" : "s"} automatically from the photo${apply ? " and updated stock levels" : ""}.` });
    setCounted({});
    setNotes("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await doSave(entered.map((i) => ({ itemId: i.id, countedQty: Number(counted[i.id]) })));
    setBusy(false);
    if (result.error) {
      setMessage({ ok: false, text: result.error });
      return;
    }
    setMessage({ ok: true, text: `Saved ${entered.length} counted item${entered.length === 1 ? "" : "s"}${apply ? " and updated stock levels" : ""}.` });
    setCounted({});
    setNotes("");
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-slate-50">New stock count</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Count what&apos;s actually on the shelf. Leave an item blank to skip it. Differences from the system are valued at
            what you last paid.
          </p>
        </div>
        <ScanButton kind="list" label="Scan everything you have" onExtracted={handleScanned} />
      </div>

      {prompt ? <div className="mt-3">{prompt}</div> : null}

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className={labelClass}>Counted on</label>
          <DateInput required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </div>
        <div className="min-w-56 flex-1">
          <label className={labelClass}>Notes (optional)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="mt-3 max-h-96 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 border-b border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium">System</th>
              <th className="w-28 px-3 py-2 text-right font-medium">Counted</th>
              <th className="px-3 py-2 text-right font-medium">Difference</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const raw = counted[i.id];
              const diff = raw !== undefined && raw !== "" ? Math.round((Number(raw) - i.qty) * 100) / 100 : null;
              return (
                <tr key={i.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="px-3 py-2 text-slate-900 dark:text-slate-50">
                    {i.name} <span className="text-xs text-slate-400">{i.unit}</span>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">{i.qty}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={raw ?? ""}
                      onChange={(e) => setCounted((c) => ({ ...c, [i.id]: e.target.value }))}
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-right text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                    />
                  </td>
                  <td
                    className={`px-3 py-2 text-right ${
                      diff === null ? "text-slate-300" : diff === 0 ? "text-green-600 dark:text-green-400" : diff < 0 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {diff === null ? "—" : `${diff > 0 ? "+" : ""}${diff}`}
                  </td>
                </tr>
              );
            })}
            {!items.length ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                  Add items first.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={apply} onChange={(e) => setApply(e.target.checked)} />
          Update stock levels to match this count
        </label>
        {entered.length ? (
          <span className={`text-sm ${variance < 0 ? "text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-400"}`}>
            {entered.length} counted · value difference {formatGBP(variance)}
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy || !entered.length} className={btnPrimary}>
          {busy ? "Saving..." : "Save count"}
        </button>
        <FormNote note={message} className="text-sm" />
      </div>
    </form>
  );
}

export function CountActions({ id, applied, canDelete }: { id: string; applied: boolean; canDelete: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<{ error: string | null }>) => {
    setBusy(true);
    setError(null);
    const r = await fn();
    setBusy(false);
    if (r.error) setError(r.error);
  };
  return (
    <span className="flex flex-wrap items-center gap-3">
      {!applied ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => confirm("Set stock levels to the counted quantities?") && run(() => applyStockCount(id))}
          className={rowBtnSecondary}
        >
          Apply to stock
        </button>
      ) : null}
      {canDelete ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => confirm("Delete this count? Stock levels already updated stay as they are.") && run(() => deleteStockCount(id))}
          className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-60"
        >
          Delete
        </button>
      ) : null}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}
