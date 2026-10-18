import { getCurrentCustomerMember } from "@/lib/supabase/identity";
import { getCustomerDeliveries } from "@/lib/supabase/portal-queries";

export default async function CustomerPortalDeliveriesPage() {
  const member = await getCurrentCustomerMember();
  if (!member) return null;

  const deliveries = await getCustomerDeliveries(member.customerId);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Deliveries</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your delivery history.</p>

      <div className="mt-4 space-y-4">
        {deliveries.map((d) => (
          <div
            key={d.id}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <p className="font-medium text-slate-900 dark:text-slate-50">{d.runDate || "Date unknown"}</p>
              {d.label ? (
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {d.label}
                </span>
              ) : null}
            </div>
            {d.items.length ? (
              <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400">
                {d.items.map((li) => (
                  <li key={li.id}>
                    {li.qty} {li.unit} {li.description}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-400">No items recorded for this stop.</p>
            )}
          </div>
        ))}
        {!deliveries.length ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-400 dark:border-slate-700">
            No deliveries yet.
          </p>
        ) : null}
      </div>
    </div>
  );
}
