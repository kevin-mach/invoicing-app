"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCustomerMember } from "@/lib/supabase/identity";

export type InviteResult = { error: string | null };

const INVITABLE_ROLES = ["bookkeeper", "staff"] as const;
type InvitableRole = (typeof INVITABLE_ROLES)[number];

export async function inviteCustomerTeamMember(
  _prevState: InviteResult,
  formData: FormData
): Promise<InviteResult> {
  const member = await getCurrentCustomerMember();
  if (!member) return { error: "You must be signed in." };
  if (member.role !== "owner") {
    return { error: "Only the owner can invite team members." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Enter an email address." };

  const requestedRole = String(formData.get("role") ?? "staff");
  if (!INVITABLE_ROLES.includes(requestedRole as InvitableRole)) {
    return { error: "Invalid role." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Team invites aren't configured yet — ask the app owner to finish admin setup." };
  }

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      invite_type: "customer_portal",
      invited_customer_id: member.customerId,
      invited_role: requestedRole,
    },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/invite/accept`,
  });

  if (error) {
    if (error.message.toLowerCase().includes("already been registered")) {
      return { error: "This email already has an account. One login can only belong to one workspace right now." };
    }
    return { error: error.message };
  }

  revalidatePath("/customer-portal/team");
  return { error: null };
}

export async function removeCustomerTeamMember(memberId: string) {
  const member = await getCurrentCustomerMember();
  if (!member) return;
  if (member.role !== "owner") return;

  const supabase = await createClient();
  await supabase.from("customer_members").delete().eq("id", memberId).eq("customer_id", member.customerId);
  revalidatePath("/customer-portal/team");
}

export async function updateCustomerTeamMemberRole(memberId: string, formData: FormData) {
  const member = await getCurrentCustomerMember();
  if (!member) return;
  if (member.role !== "owner") return;

  const requestedRole = String(formData.get("role") ?? "");
  if (!INVITABLE_ROLES.includes(requestedRole as InvitableRole)) return;

  const supabase = await createClient();
  await supabase
    .from("customer_members")
    .update({ role: requestedRole })
    .eq("id", memberId)
    .eq("customer_id", member.customerId)
    .neq("role", "owner");
  revalidatePath("/customer-portal/team");
}
