"use client";

import { useState } from "react";
import { ScanLine } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { btnSecondary } from "@/components/bookkeeping/ui";

/** For an old expense that was saved as one lump sum: reads the saved receipt photo again to get
 * the full item list, hands it to the expense form to check, and — once saved — replaces the old
 * entry. */
export function RescanReceiptButton({ expenseId, receiptPath, label }: { expenseId: string; receiptPath: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const { data, error: downloadError } = await createClient().storage.from("receipts").download(receiptPath);
          setBusy(false);
          if (downloadError || !data) {
            setError("Couldn't open the saved photo.");
            return;
          }
          const file = new File([data], receiptPath.split("/").pop() ?? "receipt.jpg", { type: data.type || "image/jpeg" });
          window.dispatchEvent(new CustomEvent("receipt-rescan", { detail: { file, expenseId, receiptPath, label } }));
        }}
        className={`${btnSecondary} inline-flex min-h-10 items-center gap-2`}
      >
        <ScanLine size={16} /> {busy ? "Opening the photo..." : "Read the items from the receipt photo"}
      </button>
      {error ? <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
