/** A category text input backed by a datalist of the org's existing categories, so users can
 * reuse a category already in use or still type a brand-new one. */
export function CategoryField({ categories, defaultValue }: { categories: string[]; defaultValue?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Category</label>
      <input
        name="category"
        list="category-options"
        defaultValue={defaultValue ?? ""}
        placeholder="e.g. Produce, Dairy"
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
      />
      <datalist id="category-options">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </div>
  );
}
