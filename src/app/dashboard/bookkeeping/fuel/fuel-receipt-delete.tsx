"use client";

import { useState } from "react";
import { deleteFuelReceipt } from "../fuel-actions";

export function FuelReceiptDelete({ id, label }: { id: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (!confirm(`Delete the fuel receipt from ${label}? Its expense and VAT come off the books too.`)) return;
          setBusy(true);
          const r = await deleteFuelReceipt(id);
          setBusy(false);
          setError(r.error);
        }}
        className="text-xs text-red-600 underline dark:text-red-400"
      >
        Delete
      </button>
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </>
  );
}
