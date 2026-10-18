import { getCurrentCustomerMember } from "@/lib/supabase/identity";
import { getCustomerItems } from "@/lib/supabase/portal-queries";
import { formatGBP } from "@/lib/format";

export default async function CustomerPortalItemsPage() {
  const member = await getCurrentCustomerMember();
  if (!member) return null;

  const items = await getCustomerItems();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Items</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">What you can order.</p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Category</th>
              <th className="px-4 py-3 font-medium">Unit</th>
              <th className="px-4 py-3 text-right font-medium">Price</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-50">
                  {i.item_code ? `${i.item_code} — ` : ""}
                  {i.name}
                </td>
                <td className="hidden px-4 py-3 text-slate-600 sm:table-cell dark:text-slate-400">
                  {i.category ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{i.unit}</td>
                <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-50">{formatGBP(i.sale_price)}</td>
              </tr>
            ))}
            {!items.length ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  No items yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
