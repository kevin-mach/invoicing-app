"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { createScannedEntries, type NamedRecord } from "@/app/dashboard/scan-actions";

/** "+ New supplier" / "+ New customer" beside a picker: type a name, add it, and it is selected.
 * An existing name (any capitalisation) is reused rather than duplicated. */
export function AddNameInline({ kind, onAdded }: { kind: "supplier" | "customer"; onAdded: (record: NamedRecord) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const result = await createScannedEntries(kind === "supplier" ? { supplierNames: [name] } : { customerNames: [name] });
    setBusy(false);
    const record = (kind === "supplier" ? result.suppliers : result.customers)[0];
    if (result.error || !record) {
      setError(result.error ?? `Couldn't add that ${kind}.`);
      return;
    }
    onAdded(record);
    setName("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-1 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-slate-700 underline dark:text-slate-300">
        <Plus size={14} /> New {kind}
      </button>
    );
  }
  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void add();
            }
          }}
          placeholder={`${kind === "supplier" ? "Supplier" : "Customer"} name`}
          className="min-h-10 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
        />
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={() => void add()}
          className="min-h-10 shrink-0 rounded-md bg-slate-900 px-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-50 dark:text-slate-900"
        >
          {busy ? "Adding..." : "Add"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-10 shrink-0 rounded-md px-3 text-sm text-slate-600 dark:text-slate-300">
          Cancel
        </button>
      </div>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
