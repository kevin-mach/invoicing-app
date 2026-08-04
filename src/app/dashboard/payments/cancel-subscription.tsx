"use client";

import { useState, useTransition } from "react";
import { cancelSubscription, resumeSubscription } from "./actions";

export function CancelSubscription({
  cancelAtPeriodEnd,
  currentPeriodEnd,
}: {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleCancel = () => {
    if (!confirm("Cancel your subscription? You'll keep access until the end of the current billing period.")) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelSubscription();
      if (result?.error) setError(result.error);
    });
  };

  const handleResume = () => {
    setError(null);
    startTransition(async () => {
      const result = await resumeSubscription();
      if (result?.error) setError(result.error);
    });
  };

  if (cancelAtPeriodEnd) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
        <p className="text-sm text-amber-800 dark:text-amber-300">
          Your subscription will cancel{currentPeriodEnd ? ` on ${new Date(currentPeriodEnd).toLocaleDateString()}` : ""}.
          You&apos;ll keep access until then.
        </p>
        <button
          type="button"
          onClick={handleResume}
          disabled={pending}
          className="mt-3 rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-amber-900"
        >
          {pending ? "Resuming..." : "Resume subscription"}
        </button>
        {error ? <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleCancel}
        disabled={pending}
        className="rounded-md px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950"
      >
        {pending ? "Canceling..." : "Cancel subscription"}
      </button>
      {error ? <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
    </div>
  );
}
