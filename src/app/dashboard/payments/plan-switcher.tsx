"use client";

import { useState, useTransition } from "react";
import { TIERS, YEARLY_SAVINGS_NOTE, type TierKey, type Cadence } from "@/lib/billing/plans";
import { changePlan } from "./actions";

export function PlanSwitcher({ currentTier, currentCadence }: { currentTier: TierKey; currentCadence: Cadence }) {
  const [cadence, setCadence] = useState<Cadence>(currentCadence);
  const [pendingTier, setPendingTier] = useState<TierKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleChoose = (tier: TierKey) => {
    setError(null);
    setPendingTier(tier);
    startTransition(async () => {
      const result = await changePlan(tier, cadence);
      if (result?.error) setError(result.error);
      setPendingTier(null);
    });
  };

  return (
    <div>
      <div className="flex justify-center">
        <div className="inline-flex rounded-md border border-slate-300 p-1 dark:border-slate-700">
          {(["monthly", "yearly"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCadence(c)}
              className={`rounded px-4 py-1.5 text-sm font-medium capitalize ${
                cadence === c
                  ? "bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="mx-auto mt-4 max-w-md rounded-md bg-red-50 px-3 py-2 text-center text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {Object.values(TIERS).map((tier) => {
          const priceInfo = tier[cadence];
          const isCurrent = tier.key === currentTier && cadence === currentCadence;
          return (
            <div
              key={tier.key}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{tier.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50">
                {priceInfo.priceLabel}
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                  /{cadence === "monthly" ? "month" : "year"}
                </span>
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Up to {tier.maxUsers} users</p>
              {cadence === "yearly" ? (
                <p className="mt-1 text-xs font-medium text-green-600 dark:text-green-400">{YEARLY_SAVINGS_NOTE}</p>
              ) : (
                <p className="mt-1 text-xs text-transparent">placeholder</p>
              )}

              <button
                type="button"
                onClick={() => handleChoose(tier.key)}
                disabled={pendingTier !== null || isCurrent}
                className="mt-6 w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-50 dark:text-slate-900"
              >
                {isCurrent ? "Current plan" : pendingTier === tier.key ? "Updating..." : `Switch to ${tier.label}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
