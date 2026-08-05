import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { AddStopForm } from "./add-stop-form";
import { RunStatusActions, RemoveStopButton } from "./run-actions";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await getCurrentOrg();
  if (!org) return null;

  const supabase = await createClient();
  const [{ data: run }, { data: stops }, { data: vendors }, { data: customers }] = await Promise.all([
    supabase.from("runs").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("run_stops")
      .select("id, stop_type, sequence, vendors(name), customers(name), checklists(id)")
      .eq("run_id", id)
      .order("sequence"),
    supabase.from("vendors").select("id, name").eq("org_id", org.orgId).order("name"),
    supabase.from("customers").select("id, name").eq("org_id", org.orgId).order("name"),
  ]);

  if (!run) notFound();

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Stock Sheet — {run.run_date}</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/runs/${run.id}/stock-sheet`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Stock count
          </Link>
          <Link
            href={`/dashboard/runs/${run.id}/report`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Condensed report
          </Link>
        </div>
      </div>

      <div className="mt-4">
        <RunStatusActions runId={run.id} status={run.status} />
      </div>

      <div className="mt-6 space-y-2">
        {stops?.map((stop, i) => {
          const name =
            stop.stop_type === "vendor"
              ? (stop.vendors as unknown as { name: string } | null)?.name
              : (stop.customers as unknown as { name: string } | null)?.name;
          const checklistId = (stop.checklists as unknown as { id: string } | null)?.id;

          return (
            <div
              key={stop.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Stop {i + 1} · {stop.stop_type === "vendor" ? "Pick up" : "Deliver"}
                </p>
                <p className="font-medium text-slate-900 dark:text-slate-50">{name ?? "—"}</p>
              </div>
              <div className="flex items-center gap-3">
                {checklistId ? (
                  <Link
                    href={`/dashboard/runs/${run.id}/checklist/${checklistId}`}
                    className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <ClipboardList size={16} /> Checklist
                  </Link>
                ) : null}
                <RemoveStopButton runId={run.id} stopId={stop.id} />
              </div>
            </div>
          );
        })}
        {!stops?.length ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-400 dark:border-slate-700">
            No stops yet. Add a supplier or customer stop below.
          </p>
        ) : null}
      </div>

      <div className="mt-6">
        <AddStopForm runId={run.id} vendors={vendors ?? []} customers={customers ?? []} />
      </div>
    </div>
  );
}
