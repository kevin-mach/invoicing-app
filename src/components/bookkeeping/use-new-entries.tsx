"use client";

import { useRef, useState, type ReactNode } from "react";
import { createScannedEntries, type ScannedEntriesResult, type NewItemInput } from "@/app/dashboard/scan-actions";
import { NewEntriesPrompt, type NewEntry } from "./new-entries-prompt";

export type ProposedEntry = NewEntry & { supplier?: string; customer?: string; item?: NewItemInput };

/** Asks the person whether to add what a scan found to their database, and only then creates it.
 * `ask` resolves with what was created, or `null` if they chose to skip. */
export function useNewEntriesPrompt(): {
  ask: (entries: ProposedEntry[]) => Promise<ScannedEntriesResult | null>;
  prompt: ReactNode;
} {
  const [open, setOpen] = useState<{ id: number; entries: ProposedEntry[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settle = useRef<((r: ScannedEntriesResult | null) => void) | null>(null);
  const counter = useRef(0);

  const ask = (entries: ProposedEntry[]) =>
    new Promise<ScannedEntriesResult | null>((resolve) => {
      settle.current?.(null);
      settle.current = resolve;
      setError(null);
      setOpen({ id: ++counter.current, entries });
    });

  const finish = (result: ScannedEntriesResult | null) => {
    settle.current?.(result);
    settle.current = null;
    setOpen(null);
  };

  const accept = async (keys: string[]) => {
    if (!open) return;
    const chosen = open.entries.filter((e) => keys.includes(e.key));
    setBusy(true);
    setError(null);
    const result = await createScannedEntries({
      supplierNames: chosen.flatMap((e) => (e.supplier ? [e.supplier] : [])),
      customerNames: chosen.flatMap((e) => (e.customer ? [e.customer] : [])),
      items: chosen.flatMap((e) => (e.item ? [e.item] : [])),
    });
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    finish(result);
  };

  const prompt = open ? (
    <NewEntriesPrompt key={open.id} entries={open.entries} busy={busy} error={error} onAccept={accept} onSkip={() => finish(null)} />
  ) : null;

  return { ask, prompt };
}
