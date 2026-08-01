"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import type { PlanKey } from "@/lib/billing/plans";

export async function selectPlan(plan: PlanKey) {
  const org = await getCurrentOrg();
  if (!org) redirect("/login");

  const supabase = await createClient();
  await supabase.rpc("select_subscription_plan", { p_plan: plan });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
