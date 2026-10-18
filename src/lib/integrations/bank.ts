import { createAdminClient } from "@/lib/supabase/admin";
import { autoProcessBankTransactions, loadOpenInvoices, loadUnpaidBills } from "@/lib/bookkeeping/auto-match";
import { roundMoney } from "@/lib/format";
import { providerConfig } from "./config";
import { apiFetch, getAccessToken, logSync } from "./store";

type TlAccount = { account_id: string; display_name?: string; account_number?: { number?: string; sort_code?: string } };
type TlTxn = {
  transaction_id: string;
  normalised_provider_transaction_id?: string;
  timestamp: string;
  description?: string;
  amount: number;
  transaction_type?: string;
};

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export async function listBankAccounts(orgId: string): Promise<{ id: string; name: string }[]> {
  const cfg = providerConfig("truelayer");
  const { token } = await getAccessToken(orgId, "truelayer");
  const res = (await apiFetch(`${cfg.apiUrl}/data/v1/accounts`, token)) as { results?: TlAccount[] };
  return (res.results ?? []).map((a) => ({
    id: a.account_id,
    name: `${a.display_name ?? "Account"}${a.account_number?.number ? ` ····${a.account_number.number.slice(-4)}` : ""}`,
  }));
}

/** Pulls new bank lines into bank_transactions. Read-only against the bank. Re-running is safe:
 * each line is keyed on the bank's own transaction id, so overlaps are skipped. */
export async function syncBank(orgId: string): Promise<{ inserted: number }> {
  const cfg = providerConfig("truelayer");
  try {
    const { token, connection } = await getAccessToken(orgId, "truelayer");
    const settings = (connection.settings ?? {}) as { disabledAccounts?: string[] };
    const disabled = new Set(settings.disabledAccounts ?? []);

    const accounts = ((await apiFetch(`${cfg.apiUrl}/data/v1/accounts`, token)) as { results?: TlAccount[] }).results ?? [];
    // First run reaches back 90 days; later runs overlap the last 5 so late-posting lines aren't missed.
    const from = connection.last_synced_at ? isoDay(new Date(new Date(connection.last_synced_at).getTime() - 5 * 86_400_000)) : isoDay(new Date(Date.now() - 90 * 86_400_000));
    const to = isoDay(new Date());

    const records: { org_id: string; txn_date: string; description: string; amount: number; fingerprint: string; source: string; external_id: string }[] = [];
    for (const a of accounts) {
      if (disabled.has(a.account_id)) continue;
      const res = (await apiFetch(`${cfg.apiUrl}/data/v1/accounts/${encodeURIComponent(a.account_id)}/transactions?from=${from}&to=${to}`, token)) as { results?: TlTxn[] };
      for (const t of res.results ?? []) {
        const id = t.normalised_provider_transaction_id || t.transaction_id;
        const magnitude = Math.abs(Number(t.amount));
        if (!id || !Number.isFinite(magnitude) || magnitude === 0) continue;
        // Sign comes from the transaction type, not the amount's own sign, which providers differ on.
        const amount = roundMoney(t.transaction_type === "DEBIT" ? -magnitude : magnitude);
        records.push({
          org_id: orgId,
          txn_date: (t.timestamp ?? "").slice(0, 10),
          description: (t.description ?? "Bank transaction").trim().slice(0, 300) || "Bank transaction",
          amount,
          fingerprint: `ob:${a.account_id}:${id}`,
          source: "openbanking",
          external_id: id,
        });
      }
    }

    const admin = createAdminClient();
    let inserted = 0;
    const insertedIds: string[] = [];
    const valid = records.filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.txn_date));
    for (let i = 0; i < valid.length; i += 500) {
      const { data, error } = await admin
        .from("bank_transactions")
        .upsert(valid.slice(i, i + 500), { onConflict: "org_id,fingerprint", ignoreDuplicates: true })
        .select("id");
      if (error) throw new Error(error.message);
      inserted += data?.length ?? 0;
      insertedIds.push(...(data ?? []).map((d) => d.id));
    }

    let autoNote = "";
    if (insertedIds.length) {
      const [invoices, bills] = await Promise.all([loadOpenInvoices(admin, orgId), loadUnpaidBills(admin, orgId)]);
      const auto = await autoProcessBankTransactions(admin, orgId, insertedIds, invoices, bills);
      const bits = [
        auto.matched ? `${auto.matched} auto-matched` : "",
        auto.banked ? `${auto.banked} cash-up(s) banked` : "",
        auto.payroll ? `${auto.payroll} payroll payment(s) matched` : "",
        auto.categorised ? `${auto.categorised} auto-categorised` : "",
      ].filter(Boolean);
      if (bits.length) autoNote = ` (${bits.join(", ")})`;
    }
    await logSync(orgId, "truelayer", "bank", "ok", inserted, `${accounts.length} account(s), ${inserted} new line(s)${autoNote}`);
    return { inserted };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Bank sync failed.";
    await logSync(orgId, "truelayer", "bank", "error", 0, message);
    throw e;
  }
}
