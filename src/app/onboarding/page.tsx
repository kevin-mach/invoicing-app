"use client";

import { useActionState } from "react";
import { createOrganization, type OnboardingState } from "./actions";

const initialState: OnboardingState = { error: null };

export default function OnboardingPage() {
  const [state, formAction, pending] = useActionState(createOrganization, initialState);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
          Set up your company
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          This creates your organization. You can invite teammates later.
        </p>

        <form action={formAction} className="mt-6 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Company name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="e.g. Fresh Route Distribution"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
            />
          </div>

          {state.error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-50 dark:text-slate-900"
          >
            {pending ? "Creating..." : "Create company"}
          </button>
        </form>
      </div>
    </main>
  );
}
