import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { getItemsWithDefaultCost } from "@/lib/supabase/items";
import { QuoteForm } from "@/components/quote-form";
import { updateQuote } from "../actions";
import { QuoteActions } from "./quote-actions";
import { PrintableQuote } from "./printable-quote";
import { PdfShareActions } from "@/components/pdf-share-actions";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await getCurrentOrg();
  if (!org) return null;

  const supabase = await createClient();
  const [{ data: quote }, { data: lineItems }, items] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", id).maybeSingle(),
    supabase.from("quote_line_items").select("*").eq("quote_id", id).order("sort_order"),
    getItemsWithDefaultCost(org.orgId),
  ]);

  if (!quote) notFound();

  const updateWithId = updateQuote.bind(null, quote.id);
  const total = (lineItems ?? []).reduce((sum, li) => sum + li.qty * li.unit_price, 0);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
          Quote for {quote.recipient_name}
        </h1>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <QuoteActions quoteId={quote.id} />
        <PdfShareActions
          targetId="quote-print"
          filename={`quote-${quote.recipient_name.replace(/\s+/g, "-").toLowerCase()}.pdf`}
          title={`Quote for ${quote.recipient_name}`}
        />
      </div>

      <div id="quote-print" className="mt-4">
        <PrintableQuote
          orgName={org.orgName}
          issueDate={quote.issue_date}
          recipientName={quote.recipient_name}
          recipientContact={quote.recipient_contact}
          lineItems={lineItems ?? []}
          total={total}
          notes={quote.notes}
        />
      </div>

      <div className="no-print mt-10 border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Edit quote</h2>
        <QuoteForm
          action={updateWithId}
          items={items}
          initialRecipientName={quote.recipient_name}
          initialRecipientContact={quote.recipient_contact ?? ""}
          initialNotes={quote.notes ?? ""}
          initialLineItems={(lineItems ?? []).map((li) => ({
            item_id: li.item_id,
            description: li.description,
            qty: li.qty,
            unit_price: li.unit_price,
          }))}
          submitLabel="Save changes"
        />
      </div>
    </div>
  );
}
