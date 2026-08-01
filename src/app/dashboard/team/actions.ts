"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrg } from "@/lib/supabase/org";

export type InviteResult = { error: string | null };

export async function inviteTeamMember(
  _prevState: InviteResult,
  formData: FormData
): Promise<InviteResult> {
  const org = await getCurrentOrg();
  if (!org) return { error: "You must be signed in." };
  if (org.role !== "owner" && org.role !== "admin") {
    return { error: "Only an owner or admin can invite team members." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Enter an email address." };

  const supabase = await createClient();
  const { count } = await supabase
    .from("org_members")
    .select("*", { count: "exact", head: true })
    .eq("org_id", org.orgId);

  if ((count ?? 0) >= org.maxUsers) {
    return { error: `Your plan is limited to ${org.maxUsers} users. Upgrade to invite more.` };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Team invites aren't configured yet — ask the app owner to finish Stripe/admin setup." };
  }

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { invited_org_id: org.orgId, invited_role: "staff" },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/invite/accept`,
  });

  if (error) {
    if (error.message.toLowerCase().includes("already been registered")) {
      return { error: "That email already has an account. Multi-organization membership isn't supported yet." };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard/team");
  return { error: null };
}

export async function removeTeamMember(memberId: string) {
  const org = await getCurrentOrg();
  if (!org) return;
  if (org.role !== "owner" && org.role !== "admin") return;

  const supabase = await createClient();
  await supabase.from("org_members").delete().eq("id", memberId).eq("org_id", org.orgId);
  revalidatePath("/dashboard/team");
}
