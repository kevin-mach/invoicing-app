"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { inviteVendorPortalMember, removeVendorPortalMember, type PortalInviteResult } from "./actions";

type Member = { id: string; user_id: string; email: string; role: string; created_at: string };

const initialState: PortalInviteResult = { error: null };

export function PortalAccess({ vendorId, members }: { vendorId: string; members: Member[] }) {
  const inviteWithId = inviteVendorPortalMember.bind(null, vendorId);
  const [state, formAction, pending] = useActionState(inviteWithId, initialState);

  return (
    <div className="mt-10 border-t border-slate-200 pt-6 dark:border-slate-800">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Portal access</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Give this supplier their own login to view purchase orders. Invite the owner first — they can invite their
        own bookkeeper or staff afterwards.
      </p>

      <form action={formAction} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Invite by email</label>
          <input
            type="email"
            name="email"
            required
            placeholder="owner@supplier.com"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Role</label>
          <select
            name="role"
            defaultValue="owner"
            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm capitalize dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          >
            <option value="owner">Owner</option>
            <option value="bookkeeper">Bookkeeper</option>
            <option value="staff">Staff</option>
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

      {members.length ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-50">{m.email}</td>
                  <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-400">{m.role}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Revoke portal access for ${m.email}?`)) {
                          removeVendorPortalMember(vendorId, m.id);
                        }
                      }}
                      className="text-slate-400 hover:text-red-600"
                      aria-label="Remove member"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
