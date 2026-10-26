import { groupForSupplierType, SUPPLIER_TYPES } from "@/lib/bookkeeping/supplier-types";

/** The "What kind of supplier" select on the supplier forms. */
export function SupplierTypeField({ defaultValue }: { defaultValue?: string | null }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">What kind of supplier</label>
      <select
        name="supplier_type"
        defaultValue={defaultValue ?? ""}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
      >
        <option value="">Not set (worked out from the name)</option>
        {SUPPLIER_TYPES.map((t) => (
          <option key={t.type} value={t.type}>
            {t.type}
            {groupForSupplierType(t.type) ? ` — everything filed as ${groupForSupplierType(t.type)}` : ""}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        A specialist (fishmonger, veg wholesaler, butcher…) puts everything on its receipts in its category. Supermarkets and cash &amp; carries are sorted item by item.
      </p>
    </div>
  );
}
