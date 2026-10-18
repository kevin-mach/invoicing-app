import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CustomerMember = {
  customerId: string;
  customerName: string;
  role: "owner" | "bookkeeper" | "staff";
  userId: string;
  userEmail: string;
};

/** Returns the signed-in user's customer-portal membership, or null if they have none.
 * Wrapped in React's cache() so the layout and the page it wraps share one lookup per request,
 * mirroring the pattern in src/lib/supabase/org.ts. */
export const getCurrentCustomerMember = cache(async (): Promise<CustomerMember | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membership } = await supabase
    .from("customer_members")
    .select("customer_id, role, customers(name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const customer = membership.customers as unknown as { name: string } | null;
  if (!customer) return null;

  return {
    customerId: membership.customer_id,
    customerName: customer.name,
    role: membership.role as CustomerMember["role"],
    userId: user.id,
    userEmail: user.email ?? "",
  };
});

export type VendorMember = {
  vendorId: string;
  vendorName: string;
  role: "owner" | "bookkeeper" | "staff";
  userId: string;
  userEmail: string;
};

/** Returns the signed-in user's supplier-portal membership, or null if they have none.
 * Wrapped in React's cache() so the layout and the page it wraps share one lookup per request,
 * mirroring the pattern in src/lib/supabase/org.ts. */
export const getCurrentVendorMember = cache(async (): Promise<VendorMember | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membership } = await supabase
    .from("vendor_members")
    .select("vendor_id, role, vendors(name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const vendor = membership.vendors as unknown as { name: string } | null;
  if (!vendor) return null;

  return {
    vendorId: membership.vendor_id,
    vendorName: vendor.name,
    role: membership.role as VendorMember["role"],
    userId: user.id,
    userEmail: user.email ?? "",
  };
});
