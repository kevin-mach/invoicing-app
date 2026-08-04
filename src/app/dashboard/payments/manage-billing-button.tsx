"use client";

import { useState, useTransition } from "react";
import { openBillingPortal } from "./actions";

export function ManageBillingButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    setError(null);
    startTransition(async () => {
      const result = await openBillingPortal();
      if (result?.error) setError(result.error);
    });
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-50 dark:text-slate-900"
      >
        {pending ? "Opening..." : "Update payment method & invoices"}
      </button>
      {error ? <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
    </div>
  );
}
