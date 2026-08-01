"use client";

import { Trash2 } from "lucide-react";
import { removeTeamMember } from "./actions";

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
