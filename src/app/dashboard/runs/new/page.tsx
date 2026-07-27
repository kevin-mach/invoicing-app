"use client";

import { useActionState } from "react";
import { createRun, type RunFormState } from "../actions";

const initialState: RunFormState = { error: null };

export default function NewRunPage() {
  const [state, formAction, pending] = useActionState(createRun, initialState);

  return (
    <div className="max-w-sm">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">New run</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        You&apos;ll add vendor and customer stops after creating the run.
      </p>
      <form action={formAction} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Date</label>
          <input
            type="date"
            name="run_date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          />
        </div>
        {state.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p> : null}
        <button type="submit" disabled={pending} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-50 dark:text-slate-900">
          {pending ? "Creating..." : "Create run"}
        </button>
      </form>
    </div>
  );
}
