"use client";

import { useActionState } from "react";
import { inviteTeamMember, type InviteResult } from "./actions";

const initialState: InviteResult = { error: null };

export function InviteForm({ atLimit }: { atLimit: boolean }) {
  const [state, formAction, pending] = useActionState(inviteTeamMember, initialState);

  if (atLimit) {
    return (
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
        You&apos;ve reached your plan&apos;s seat limit.{" "}
        <a href="/billing/upgrade" className="font-medium underline">
          Upgrade
        </a>{" "}
        to invite more team members.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex-1">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Invite by email</label>
        <input
          type="email"
          name="email"
          required
          placeholder="teammate@example.com"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Role</label>
        <select
          name="role"
          defaultValue="staff"
          className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm capitalize dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
        >
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
          <option value="bookkeeper">Bookkeeper</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-50 dark:text-slate-900"
      >
        {pending ? "Sending..." : "Send invite"}
      </button>
      {state.error ? (
        <p className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
