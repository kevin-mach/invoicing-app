"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { PurchaseFormState, PurchaseLineItemInput } from "@/app/dashboard/purchases/actions";
import type { ItemOption } from "@/lib/supabase/items";
import { ReceiptScanner } from "@/components/receipt-scanner";
import type { ParsedReceiptLine } from "@/lib/ocr/parse-lines";
import { ScanButton } from "@/components/bookkeeping/scan-button";
import type { ScanExtraction } from "@/lib/scan/extract";
import { matchCatalogItem, matchVendor } from "@/lib/scan/match-items";
import { reconcileBill } from "@/lib/scan/bill-math";
import { AddNameInline } from "@/components/add-name-inline";
import { PropertyFields } from "@/components/property-details";
import { emptyPropertyDetails, hasPropertyDetails, type PropertyDetails } from "@/lib/property";
import { useNewEntriesPrompt, type ProposedEntry } from "@/components/bookkeeping/use-new-entries";
import { formatGBP, roundMoney, roundQty } from "@/lib/format";
import { DateInput } from "@/components/date-input";
import { VAT_RATES } from "@/lib/bookkeeping/categories";

type Vendor = { id: string; name: string };
type Row = PurchaseLineItemInput & { key: string };

const emptyRow = (): Row => ({ key: crypto.randomUUID(), item_id: null, description: "", qty: 1, unit_cost: 0, vat_rate: 0 });

export function PurchaseForm({
  action,
  orgId,
  vendors,
  items,
  initialVendorId,
  initialNotes,
  initialLineItems,
  submitLabel = "Save purchase",
  autoSaveScans = false,
  propertyMode = false,
}: {
  action: (state: PurchaseFormState, formData: FormData) => Promise<PurchaseFormState>;
  orgId: string;
  vendors: Vendor[];
  items: ItemOption[];
  initialVendorId?: string;
  initialNotes?: string;
  initialLineItems?: PurchaseLineItemInput[];
  submitLabel?: string;
  autoSaveScans?: boolean;
  /** A property investment company: keeps the agent's property statement (managed property, rent, balance due, dates) with the purchase. */
  propertyMode?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null } as PurchaseFormState);
  const [vendorId, setVendorId] = useState(initialVendorId ?? "");
  const [supplierRef, setSupplierRef] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
  const [scanNotes, setScanNotes] = useState<string[]>([]);
  const [property, setProperty] = useState<PropertyDetails>(emptyPropertyDetails());
  const [rows, setRows] = useState<Row[]>(
    initialLineItems?.length ? initialLineItems.map((li) => ({ ...li, key: crypto.randomUUID() })) : [emptyRow()]
  );
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [extraVendors, setExtraVendors] = useState<Vendor[]>([]);
  const [extraItems, setExtraItems] = useState<ItemOption[]>([]);
  const { ask, prompt } = useNewEntriesPrompt();

  const allVendors = useMemo(() => [...vendors, ...extraVendors.filter((e) => !vendors.some((v) => v.id === e.id))], [vendors, extraVendors]);
  const catalog = useMemo(() => [...items, ...extraItems.filter((e) => !items.some((i) => i.id === e.id))], [items, extraItems]);
  const itemsById = useMemo(() => new Map(catalog.map((i) => [i.id, i])), [catalog]);

  const updateRow = (key: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };
  const removeRow = (key: string) => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const handleScanned = (parsed: ParsedReceiptLine[], url: string) => {
    setImageUrl(url);
    if (!parsed.length) return;
    setRows((prev) => {
      const blank = prev.filter((r) => r.description.trim() || r.item_id);
      const scanned = parsed.map((p) => ({
        key: crypto.randomUUID(),
        item_id: null,
        description: p.description,
        qty: p.qty,
        unit_cost: p.unit_cost,
        vat_rate: 0,
      }));
      return blank.length ? [...blank, ...scanned] : scanned;
    });
  };

  const handleAiScanned = async (raw: ScanExtraction) => {
    if (raw.kind !== "bill") return;
    setAutoSaveError(null);
    // Costs are stored before VAT, so a receipt whose prices already include VAT is converted first.
    const rec = reconcileBill(raw);
    const data = { ...raw, lines: rec.lines };
    setScanNotes([...rec.warnings, ...rec.notices]);
    if (propertyMode && raw.property) setProperty(raw.property);

    let vendorList = allVendors;
    let catalogList = catalog;
    let vendorMatch = data.vendorName ? matchVendor(data.vendorName, vendorList) : null;

    // Anything the photo mentions that isn't in the database yet is only added if the person says so.
    const proposed = new Map<string, ProposedEntry>();
    if (data.vendorName && !vendorMatch) {
      proposed.set(`s:${data.vendorName}`, { key: `s:${data.vendorName}`, kind: "Supplier", label: data.vendorName, supplier: data.vendorName });
    }
    for (const l of data.lines) {
      if (matchCatalogItem(l.description, catalogList) || proposed.has(`i:${l.description}`)) continue;
      proposed.set(`i:${l.description}`, {
        key: `i:${l.description}`,
        kind: "Item",
        label: l.description,
        detail: `${l.qty} × ${formatGBP(l.unitCost)}`,
        item: { name: l.description, unit: "unit", vatRate: l.vatRate },
      });
    }

    let resolved = true;
    if (proposed.size) {
      const created = await ask([...proposed.values()]);
      if (!created) {
        resolved = false;
      } else {
        vendorList = [...vendorList, ...created.suppliers];
        catalogList = [...catalogList, ...created.items];
        setExtraVendors((p) => [...p, ...created.suppliers]);
        setExtraItems((p) => [...p, ...created.items]);
        vendorMatch = data.vendorName ? matchVendor(data.vendorName, vendorList) : null;
        resolved = (!data.vendorName || !!vendorMatch) && data.lines.every((l) => !!matchCatalogItem(l.description, catalogList));
      }
    }

    if (vendorMatch) setVendorId(vendorMatch.id);
    if (data.billNumber) setSupplierRef(data.billNumber);
    if (data.dueDate) setDueDate(data.dueDate);

    const nextRows: Row[] = data.lines.length
      ? data.lines.map((l) => {
          const item = matchCatalogItem(l.description, catalogList);
          return {
            key: crypto.randomUUID(),
            item_id: item?.id ?? null,
            description: item ? item.name : l.description,
            qty: l.qty,
            unit_cost: l.unitCost,
            vat_rate: l.vatRate,
          };
        })
      : rows;
    if (data.lines.length) setRows(nextRows);

    // Auto-save needs an exact supplier, every line settled (matched or just added with the
    // person's say-so), and at least one real line item.
    const validLines = nextRows.filter((r) => r.description.trim() && r.qty > 0);
    const ready = autoSaveScans && resolved && vendorMatch && data.lines.length && validLines.length === nextRows.length && !rec.warnings.length;
    if (!ready || !vendorMatch) return;

    setAutoSaving(true);
    const formData = new FormData();
    formData.set("vendor_id", vendorMatch.id);
    formData.set("supplier_ref", data.billNumber ?? "");
    formData.set("due_date", data.dueDate ?? "");
    formData.set("notes", "");
    formData.set("image_url", "");
    if (propertyMode && raw.property) formData.set("property_details", JSON.stringify(raw.property));
    formData.set("line_items", JSON.stringify(validLines.map(({ key: _key, ...rest }) => rest)));
    const result = await action({ error: null }, formData);
    setAutoSaving(false);
    // On success `action` (createPurchase) redirects to the new purchase, which unmounts this
    // form — so only the failure path is ever seen here.
    if (result.error) setAutoSaveError(`Couldn't auto-save — ${result.error} Check the details below and save manually.`);
  };

  const net = roundMoney(rows.reduce((sum, r) => sum + r.qty * r.unit_cost, 0));
  const vatTotal = roundMoney(rows.reduce((sum, r) => sum + (r.qty * r.unit_cost * (Number(r.vat_rate) || 0)) / 100, 0));
  const total = roundMoney(net + vatTotal);

  return (
    <form action={formAction} className="mt-6 space-y-6">
      <input type="hidden" name="line_items" value={JSON.stringify(rows.map(({ key: _key, ...rest }) => rest))} />
      <input type="hidden" name="image_url" value={imageUrl ?? ""} />
      <input type="hidden" name="property_details" value={propertyMode && hasPropertyDetails(property) ? JSON.stringify(property) : ""} />

      {prompt}

      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Supplier</label>
          <select
            name="vendor_id"
            required
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          >
            <option value="">Select a supplier...</option>
            {allVendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <AddNameInline
            kind="supplier"
            onAdded={(v) => {
              setExtraVendors((p) => [...p, v]);
              setVendorId(v.id);
            }}
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <ReceiptScanner orgId={orgId} onScanned={handleScanned} />
          <ScanButton kind="bill" label="Scan with AI" onExtracted={handleAiScanned} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Supplier invoice no. (optional)</label>
          <input
            name="supplier_ref"
            value={supplierRef}
            onChange={(e) => setSupplierRef(e.target.value)}
            placeholder="Their invoice number"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Payment due (optional)</label>
          <DateInput
            name="due_date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Notes</label>
          <textarea
            name="notes"
            rows={2}
            defaultValue={initialNotes ?? ""}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          />
        </div>
      </div>

      {propertyMode ? <PropertyFields value={property} onChange={setProperty} title="Agent's property statement (managed property, rent and dates)" /> : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="lines w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="w-20 px-3 py-2 text-right font-medium">Qty</th>
              <th className="w-24 px-3 py-2 text-right font-medium">Cost</th>
              <th className="w-20 px-3 py-2 text-right font-medium">VAT %</th>
              <th className="w-24 px-3 py-2 text-right font-medium">Line total</th>
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="px-3 py-2" data-label="Item" data-wide>
                  <select
                    value={row.item_id ?? ""}
                    onChange={(e) => {
                      const item = itemsById.get(e.target.value);
                      if (item) {
                        updateRow(row.key, { item_id: item.id, description: item.name, unit_cost: item.default_cost || row.unit_cost });
                      } else {
                        updateRow(row.key, { item_id: null });
                      }
                    }}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                  >
                    <option value="">Custom</option>
                    {catalog.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.item_code} - {i.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2" data-label="Description" data-wide>
                  <input
                    value={row.description}
                    onChange={(e) => updateRow(row.key, { description: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                  />
                </td>
                <td className="px-3 py-2" data-label="Qty">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.qty}
                    onChange={(e) => updateRow(row.key, { qty: roundQty(Number(e.target.value) || 0) })}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                  />
                </td>
                <td className="px-3 py-2" data-label="Cost">
                  <input
                    type="number"
                    step="0.01"
                    title="Enter a negative cost for a discount or credit"
                    value={row.unit_cost}
                    onChange={(e) => updateRow(row.key, { unit_cost: Number(e.target.value) || 0 })}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                  />
                </td>
                <td className="px-3 py-2" data-label="VAT %">
                  <select
                    value={row.vat_rate ?? 0}
                    onChange={(e) => updateRow(row.key, { vat_rate: Number(e.target.value) })}
                    className="w-full rounded-md border border-slate-300 px-1 py-1.5 text-right text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                  >
                    {VAT_RATES.map((r) => (
                      <option key={r} value={r}>
                        {r}%
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-right text-slate-900 dark:text-slate-50" data-label="Line total">
                  {formatGBP(row.qty * row.unit_cost)}
                </td>
                <td className="px-3 py-2 text-right" data-remove>
                  <button type="button" onClick={() => removeRow(row.key)} className="text-slate-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1 border-t border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Plus size={16} /> Add line
        </button>
      </div>

      <div className="flex justify-end">
        <div className="w-full max-w-xs space-y-1 rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>Net</span>
            <span>{formatGBP(net)}</span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>VAT</span>
            <span>{formatGBP(vatTotal)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
            <span>Total cost</span>
            <span>{formatGBP(total)}</span>
          </div>
        </div>
      </div>

      {state.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p> : null}
      {scanNotes.length ? (
        <ul className="space-y-1 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {scanNotes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
      {autoSaveError ?<p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{autoSaveError}</p> : null}
      {autoSaving ? <p className="text-sm text-slate-500 dark:text-slate-400">Saving automatically from the photo...</p> : null}

      <button
        type="submit"
        disabled={pending || autoSaving}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-50 dark:text-slate-900"
      >
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
