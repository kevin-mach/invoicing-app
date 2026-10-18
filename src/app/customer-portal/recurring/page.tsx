import { getCurrentCustomerMember } from "@/lib/supabase/identity";
import { getCustomerRecurringTemplates } from "@/lib/supabase/portal-queries";
import { formatGBP } from "@/lib/format";

export default async function CustomerPortalRecurringPage() {
  const member = await getCurrentCustomerMember();
  if (!member) return null;

  const templates = await getCustomerRecurringTemplates(member.customerId);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Recurring invoices</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Standing orders set up for your account.</p>

      <div className="mt-4 space-y-4">
        {templates.map((t) => (
          <div
            key={t.id}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <p className="font-medium capitalize text-slate-900 dark:text-slate-50">{t.cadence}</p>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  t.active
                    ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {t.active ? "Active" : "Paused"}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Next run: {t.next_run_date}</p>
            {t.lineItems.length ? (
              <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
                {t.lineItems.map((li) => (
                  <li key={li.id} className="flex justify-between">
                    <span>
                      {li.qty} × {li.description}
                    </span>
                    <span>{formatGBP(li.unit_price)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
        {!templates.length ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-400 dark:border-slate-700">
            No recurring invoices set up.
          </p>
        ) : null}
      </div>
    </div>
  );
}
