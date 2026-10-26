"use client";

import { useState } from "react";
import { btnPrimary, FormNote, inputClass, labelClass, rowBtnSecondary, rowInputClass, type FormStatus } from "@/components/bookkeeping/ui";
import type { ProductGroup } from "@/lib/bookkeeping/supplier-types";
import { deleteProductGroup, saveProductGroup } from "../product-groups-actions";

function GroupRow({ group, count }: { group: ProductGroup; count: number }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [keywords, setKeywords] = useState(group.keywords.join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<{ error: string | null }>) => {
    setBusy(true);
    setError(null);
    const r = await fn();
    setBusy(false);
    if (r.error) setError(r.error);
    else setEditing(false);
  };

  return (
    <li className="py-3 text-sm">
      {editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className={`${rowInputClass} w-44`} />
          <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="Keywords, comma separated" className={`${rowInputClass} min-w-0 flex-1`} />
          <button type="button" disabled={busy} onClick={() => run(() => saveProductGroup(group.id, name, keywords))} className={rowBtnSecondary}>
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} className={rowBtnSecondary}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium text-slate-900 dark:text-slate-50">
              {group.name} <span className="font-normal text-slate-500">· {count} item{count === 1 ? "" : "s"}</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{group.keywords.length ? `Picks up: ${group.keywords.join(", ")}` : "No keywords — lines are only put here by hand"}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(true)} className={rowBtnSecondary}>
              Edit
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (confirm(`Delete "${group.name}"? Items in it will have no group until you pick another.`)) void run(() => deleteProductGroup(group.id));
              }}
              className={rowBtnSecondary}
            >
              Delete
            </button>
          </div>
        </div>
      )}
      {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </li>
  );
}

export function GroupsManager({ groups, counts }: { groups: ProductGroup[]; counts: Record<string, number> }) {
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<FormStatus>(null);

  const add = async () => {
    setBusy(true);
    setNote(null);
    const r = await saveProductGroup(null, name, keywords);
    setBusy(false);
    if (r.error) {
      setNote({ ok: false, text: r.error });
      return;
    }
    setName("");
    setKeywords("");
    setNote({ ok: true, text: "Group added." });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="font-semibold text-slate-900 dark:text-slate-50">Your own groups</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Split things the built-in groups lump together — e.g. &ldquo;Kitchenware&rdquo; and &ldquo;Cleaning materials&rdquo; instead of both being Household &amp; packaging.
        Keywords sort scanned lines into the group automatically.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
        <div>
          <label className={labelClass}>Group name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cleaning materials" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Keywords (comma separated)</label>
          <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="e.g. bleach, caustic, detergent, sanitiser" className={inputClass} />
        </div>
        <button type="button" disabled={busy} onClick={add} className={btnPrimary}>
          {busy ? "Adding..." : "Add group"}
        </button>
      </div>
      <FormNote note={note} />
      <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
        {groups.map((g) => (
          <GroupRow key={g.id} group={g} count={counts[g.name.toLowerCase()] ?? 0} />
        ))}
        {!groups.length ? <li className="py-3 text-sm text-slate-400">No groups of your own yet.</li> : null}
      </ul>
    </div>
  );
}
