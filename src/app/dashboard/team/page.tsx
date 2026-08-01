import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { TIERS } from "@/lib/billing/plans";
import { InviteForm } from "./invite-form";
import { RemoveMemberButton } from "./member-actions";

export default async function TeamPage() {
  const org = await getCurrentOrg();
  if (!org) return null;

  const supabase = await createClient();
  const { data: members } = await supabase.rpc("get_org_members", { p_org_id: org.orgId });
  const memberCount = members?.length ?? 0;
  const canManage = org.role === "owner" || org.role === "admin";

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Team</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {memberCount} of {org.maxUsers} seats used on the {`${TIERS[org.subscriptionTier].label} plan`}. Every
        team member can see all of this organization&apos;s invoices, runs, vendors, customers, and items.
      </p>

      {canManage ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <InviteForm atLimit={memberCount >= org.maxUsers} />
        </div>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              {canManage ? <th className="px-4 py-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {members?.map((m) => (
              <tr key={m.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="px-4 py-3 text-slate-900 dark:text-slate-50">{m.email}</td>
                <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-400">{m.role}</td>
                {canManage ? (
                  <td className="px-4 py-3 text-right">
                    {m.user_id !== org.userId ? <RemoveMemberButton memberId={m.id} name={m.email} /> : null}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
