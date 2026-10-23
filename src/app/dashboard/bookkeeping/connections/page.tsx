import { createClient } from "@/lib/supabase/server";
import { requireBookkeeper } from "@/lib/bookkeeping/access";
import { encryptionConfigured } from "@/lib/integrations/crypto";
import { isConfigured, PROVIDERS, providerConfig, type Provider } from "@/lib/integrations/config";
import { scanConfigured } from "@/lib/scan/extract";
import { AccountingPanel, AutoSaveScanToggle, BusinessTypeSetting, BankAccounts, HmrcPanel, ProviderActions } from "./connections-client";

const SYNCABLE: Provider[] = ["truelayer", "square"];

const STATUS_STYLE: Record<string, string> = {
  connected: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  error: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  disconnected: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  const org = await requireBookkeeper();
  if (!org) return null;
  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: conns }, { data: logs }] = await Promise.all([
    supabase.from("integration_connections").select("*").eq("org_id", org.orgId),
    supabase.from("sync_logs").select("*").eq("org_id", org.orgId).order("created_at", { ascending: false }).limit(12),
  ]);
  const byProvider = new Map((conns ?? []).map((c) => [c.provider, c]));
  const encOk = encryptionConfigured();

  return (
    <div className="space-y-6">
      {params.connected ? (
        <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          Connected to {params.connected}.
        </p>
      ) : null}
      {params.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">{params.error}</p>
      ) : null}

      <p className="text-sm text-slate-600 dark:text-slate-400">
        Connect once and it runs from then on. Bank lines and POS sales are pulled in automatically every day. Anything that goes <em>out</em> —
        to Xero, QuickBooks or HMRC — is previewed and sent only when you say so.
      </p>

      <div className="grid gap-4">
        {PROVIDERS.map((p) => {
          const cfg = providerConfig(p);
          const conn = byProvider.get(p);
          const configured = isConfigured(cfg) && encOk;
          const status = conn?.status ?? "disconnected";
          const connected = status === "connected" || status === "error";
          const settings = (conn?.settings ?? {}) as Record<string, string>;
          const canManage = p === "hmrc" ? org.role === "owner" : true;

          return (
            <section key={p} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-slate-50">
                    {cfg.name}
                    {cfg.beta ? <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">Beta</span> : null}
                    {cfg.sandbox && configured ? <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">Sandbox</span> : null}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{cfg.purpose}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? STATUS_STYLE.disconnected}`}>
                  {status === "connected" ? "Connected" : status === "error" ? "Needs attention" : "Not connected"}
                </span>
              </div>

              {conn?.account_name && connected ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{conn.account_name}</p> : null}
              {conn?.last_synced_at ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">Last synced {new Date(conn.last_synced_at).toLocaleString("en-GB")}</p>
              ) : null}
              {conn?.last_error ? <p className="mt-1 text-sm text-red-600 dark:text-red-400">{conn.last_error}</p> : null}

              {!configured ? (
                <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                  <p className="font-medium">Not switched on for this server yet.</p>
                  <p className="mt-1">
                    The operator needs to add {cfg.envVars.join(", ")}
                    {encOk ? "" : ", INTEGRATIONS_ENCRYPTION_KEY"} to the environment. Once that&apos;s done, clients only need to press Connect.
                  </p>
                </div>
              ) : (
                <div className="mt-3">
                  <ProviderActions provider={p} connected={connected} syncable={SYNCABLE.includes(p)} canManage={canManage} />
                  {connected && p === "truelayer" ? <BankAccounts /> : null}
                  {connected && (p === "xero" || p === "quickbooks") ? <AccountingPanel provider={p} settings={settings} /> : null}
                  {connected && p === "hmrc" && canManage ? (
                    <HmrcPanel vrn={conn?.account_id ?? org.vatNumber ?? ""} environment={cfg.sandbox ? "sandbox" : "production"} />
                  ) : null}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-semibold text-slate-900 dark:text-slate-50">AI photo scanning</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Scan a receipt, a supplier bill, a till count or a shelf of stock and have Claude read the figures off the
          photo straight into the form.
        </p>
        {!scanConfigured() ? (
          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-400">
            <p className="font-medium">Not switched on for this server yet.</p>
            <p className="mt-1">The operator needs to add ANTHROPIC_API_KEY to the environment. Once that&apos;s done, the scan buttons across Expenses, Cash-up, Purchases, Stock counts, Invoices, Quotes, Checklists and the Stock sheet start working.</p>
          </div>
        ) : (
          <AutoSaveScanToggle autoSaveScans={org.autoSaveScans} canEdit={org.role === "owner" || org.role === "admin"} />
        )}
        <BusinessTypeSetting businessType={org.businessType} canEdit={org.role === "owner" || org.role === "admin"} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-semibold text-slate-900 dark:text-slate-50">Recent activity</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {(logs ?? []).map((l) => (
            <li key={l.id} className="flex flex-wrap gap-x-3 text-slate-600 dark:text-slate-400">
              <span className="text-slate-400">{new Date(l.created_at).toLocaleString("en-GB")}</span>
              <span className="font-medium">{l.provider}</span>
              <span className={l.status === "error" ? "text-red-600 dark:text-red-400" : ""}>{l.message ?? l.kind}</span>
            </li>
          ))}
          {!logs?.length ? <li className="text-slate-400">Nothing yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}
