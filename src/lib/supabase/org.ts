import { createClient } from "@/lib/supabase/server";

export type CurrentOrg = {
  orgId: string;
  orgName: string;
  role: "owner" | "admin" | "staff";
  userId: string;
  userEmail: string;
};

/** Returns the signed-in user's first organization, or null if they have none yet. */
export async function getCurrentOrg(): Promise<CurrentOrg | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id, role, organizations(name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const orgName = (membership.organizations as unknown as { name: string } | null)?.name ?? "";

  return {
    orgId: membership.org_id,
    orgName,
    role: membership.role as CurrentOrg["role"],
    userId: user.id,
    userEmail: user.email ?? "",
  };
}
