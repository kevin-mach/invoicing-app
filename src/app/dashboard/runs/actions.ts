"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";

export type RunFormState = { error: string | null };

export async function createRun(
  _prevState: RunFormState,
  formData: FormData
): Promise<RunFormState> {
  const org = await getCurrentOrg();
  if (!org) redirect("/onboarding");

  const supabase = await createClient();
  const { data: run, error } = await supabase
    .from("runs")
    .insert({
      org_id: org.orgId,
      user_id: org.userId,
      run_date: String(formData.get("run_date") ?? "") || new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();

  if (error || !run) return { error: error?.message ?? "Could not create run." };

  revalidatePath("/dashboard/runs");
  redirect(`/dashboard/runs/${run.id}`);
}

export async function addRunStop(runId: string, formData: FormData) {
  const stopType = String(formData.get("stop_type") ?? "");
  const entityId = String(formData.get("entity_id") ?? "");
  if (!stopType || !entityId) return;

  const supabase = await createClient();
  const { count } = await supabase
    .from("run_stops")
    .select("*", { count: "exact", head: true })
    .eq("run_id", runId);

  const { data: stop, error } = await supabase
    .from("run_stops")
    .insert({
      run_id: runId,
      stop_type: stopType,
      vendor_id: stopType === "vendor" ? entityId : null,
      customer_id: stopType === "customer" ? entityId : null,
      sequence: count ?? 0,
    })
    .select("id")
    .single();

  if (!error && stop) {
    await supabase.from("checklists").insert({ run_stop_id: stop.id });
  }

  revalidatePath(`/dashboard/runs/${runId}`);
}

export async function deleteRunStop(runId: string, stopId: string) {
  const supabase = await createClient();
  await supabase.from("run_stops").delete().eq("id", stopId);
  revalidatePath(`/dashboard/runs/${runId}`);
}

export async function updateRunStatus(runId: string, status: string) {
  const supabase = await createClient();
  await supabase.from("runs").update({ status }).eq("id", runId);
  revalidatePath(`/dashboard/runs/${runId}`);
  revalidatePath("/dashboard/runs");
}

export async function deleteRun(id: string) {
  const supabase = await createClient();
  await supabase.from("runs").delete().eq("id", id);
  revalidatePath("/dashboard/runs");
  redirect("/dashboard/runs");
}
