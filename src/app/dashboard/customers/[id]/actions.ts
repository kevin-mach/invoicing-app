"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrg } from "@/lib/supabase/org";

export type PortalInviteResult = { error: string | null };

const INVITABLE_CUSTOMER_ROLES = ["owner", "bookkeeper", "staff"] as const;
type InvitableCustomerRole = (typeof INVITABLE_CUSTOMER_ROLES)[number];

export async function inviteCustomerPortalMember(
  customerId: string,
  _prevState: PortalInviteResult,
  formData: FormData
): Promise<PortalInviteResult> {
  const org = await getCurrentOrg();
  if (!org) return { error: "You must be signed in." };
  if (org.role !== "owner" && org.role !== "admin") {
    return { error: "Only an owner or admin can invite portal access." };
  }

  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("org_id", org.orgId)
    .maybeSingle();
  if (!customer) return { error: "Customer not found." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Enter an email address." };

  const requestedRole = String(formData.get("role") ?? "owner");
  if (!INVITABLE_CUSTOMER_ROLES.includes(requestedRole as InvitableCustomerRole)) {
    return { error: "Invalid role." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Portal invites aren't configured yet — ask the app owner to finish admin setup." };
  }

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      invite_type: "customer_portal",
      invited_customer_id: customer.id,
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

  revalidatePath(`/dashboard/customers/${customerId}`);
  return { error: null };
}

export async function removeCustomerPortalMember(customerId: string, memberId: string) {
  const org = await getCurrentOrg();
  if (!org) return;
  if (org.role !== "owner" && org.role !== "admin") return;

  const supabase = await createClient();
  await supabase.from("customer_members").delete().eq("id", memberId).eq("customer_id", customerId);
  revalidatePath(`/dashboard/customers/${customerId}`);
}
