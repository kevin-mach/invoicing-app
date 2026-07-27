"use client";

import { useActionState } from "react";
import { updateCustomer, deleteCustomer, type CustomerFormState } from "../actions";
import type { Tables } from "@/lib/supabase/types";

const initialState: CustomerFormState = { error: null };

export function EditCustomerForm({ customer }: { customer: Tables<"customers"> }) {
  const updateWithId = updateCustomer.bind(null, customer.id);
  const [state, formAction, pending] = useActionState(updateWithId, initialState);

  return (
    <form action={formAction} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
        <input name="name" required defaultValue={customer.name} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
        <input name="email" type="email" defaultValue={customer.email ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Phone</label>
        <input name="phone" defaultValue={customer.phone ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Address</label>
        <input name="address" defaultValue={customer.address ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Notes</label>
        <textarea name="notes" rows={3} defaultValue={customer.notes ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50" />
      </div>
      {state.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p> : null}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-50 dark:text-slate-900">
          {pending ? "Saving..." : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Delete ${customer.name}? This cannot be undone.`)) {
              deleteCustomer(customer.id);
            }
          }}
          className="rounded-md px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
        >
          Delete
        </button>
      </div>
    </form>
  );
}
