import { getCurrentOrg } from "@/lib/supabase/org";
import { getItemsWithDefaultCost } from "@/lib/supabase/items";
import { QuoteForm } from "@/components/quote-form";
import { createQuote } from "../actions";

export default async function NewQuotePage() {
  const org = await getCurrentOrg();
  if (!org) return null;

  const items = await getItemsWithDefaultCost(org.orgId);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">New quote</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Build a priced item list to send to a prospective customer — doesn&apos;t require an existing customer record.
      </p>
      <QuoteForm action={createQuote} items={items} submitLabel="Create quote" />
    </div>
  );
}
