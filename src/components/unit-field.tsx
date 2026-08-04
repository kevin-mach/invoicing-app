"use client";

import { useState } from "react";

export const UNIT_PRESETS = ["unit", "kg", "g", "L", "ml", "lb", "oz", "box", "case", "dozen", "pack"];

/** A unit-of-measurement input: a dropdown of common units (weights, volumes, and count-based units), with a
 * "Custom" fallback for anything else so existing free-text values are never silently dropped. */
export function UnitField({ defaultValue }: { defaultValue: string }) {
  const isPreset = UNIT_PRESETS.includes(defaultValue);
  const [isCustom, setIsCustom] = useState(!isPreset);

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Unit</label>
      <select
        defaultValue={isPreset ? defaultValue : "custom"}
        onChange={(e) => setIsCustom(e.target.value === "custom")}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
        {...(isCustom ? {} : { name: "unit" })}
      >
        {UNIT_PRESETS.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
        <option value="custom">Custom...</option>
      </select>
      {isCustom ? (
        <input
          name="unit"
          defaultValue={isPreset ? "" : defaultValue}
          placeholder="e.g. crate"
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
        />
      ) : null}
    </div>
  );
}
