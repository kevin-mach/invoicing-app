"use client";

import { useState } from "react";
import { detectPosColumns, parsePosRows, POS_FIELDS, type PosColumns, type PosDay } from "@/lib/bookkeeping/pos";
import { formatGBP, roundMoney } from "@/lib/format";
import { CsvImportPanel } from "@/components/bookkeeping/csv-import";
import { deletePosDay, importPosDays } from "../pos-actions";

export function PosImport() {
  return (
    <CsvImportPanel<PosColumns, PosDay, Awaited<ReturnType<typeof importPosDays>>>
      title="Import daily sales"
      description="Upload an end-of-day or sales summary export from your till (Square, SumUp, Lightspeed, Toast, EPOS Now, Zettle…), one row per day. Columns are detected automatically; check the mapping below."
      fields={POS_FIELDS}
      detectColumns={detectPosColumns}
      parse={(rows, cols) => {
        const r = parsePosRows(rows, cols);
        return { items: r.days, skipped: r.skipped };
      }}
      onImport={importPosDays}
      renderSummary={(parsed, cols) => {
        const net = roundMoney(parsed.items.reduce((s, d) => s + d.net_sales, 0));
        const vat = roundMoney(parsed.items.reduce((s, d) => s + d.vat_amount, 0));
        return (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {parsed.items.length} day{parsed.items.length === 1 ? "" : "s"} · net sales {formatGBP(net)} · VAT {formatGBP(vat)}
              {parsed.skipped ? ` · ${parsed.skipped} row(s) skipped` : ""}
            </p>
            {!cols.vat_amount && !cols.net_sales ? (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                No VAT or net column mapped — sales will be treated as having no VAT, so output VAT won&apos;t be counted from POS.
              </p>
            ) : null}
          </>
        );
      }}
      successText={(r) => `Saved ${r.saved} day${r.saved === 1 ? "" : "s"}. Re-uploading the same dates replaces them, so it's safe to repeat.`}
    />
  );
}

export function DeletePosDay({ id, label }: { id: string; label: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!confirm(`Remove sales for ${label}?`)) return;
        setBusy(true);
        await deletePosDay(id);
        setBusy(false);
      }}
      className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-60"
    >
      Remove
    </button>
  );
}
