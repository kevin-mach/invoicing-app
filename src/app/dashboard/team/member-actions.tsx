"use client";

import { Trash2 } from "lucide-react";
import { removeTeamMember, updateMemberRole } from "./actions";

export function RemoveMemberButton({ memberId, name }: { memberId: string; name: string }) {
  return (
    <button
      onClick={() => {
        if (confirm(`Remove ${name} from this organization?`)) removeTeamMember(memberId);
      }}
      className="text-slate-400 hover:text-red-600"
      aria-label="Remove member"
    >
      <Trash2 size={16} />
    </button>
  );
}

const ROLE_OPTIONS = ["staff", "admin", "bookkeeper"] as const;

export function RoleSelect({ memberId, role }: { memberId: string; role: string }) {
  return (
    <form action={updateMemberRole.bind(null, memberId)}>
      <select
        name="role"
        defaultValue={role}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm capitalize dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
      >
        {ROLE_OPTIONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </form>
  );
}
