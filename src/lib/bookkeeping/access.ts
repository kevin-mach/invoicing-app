import { getCurrentOrg, type CurrentOrg } from "@/lib/supabase/org";

/** Bookkeeping data (bank lines, expenses, payments) is owner + bookkeeper only. The database
 * enforces the same rule via is_org_bookkeeping(); this guard gives server actions and pages a
 * clean early exit instead of a silent empty result. */
export async function requireBookkeeper(): Promise<CurrentOrg | null> {
  const org = await getCurrentOrg();
  if (!org) return null;
  if (org.role !== "owner" && org.role !== "bookkeeper") return null;
  return org;
}
