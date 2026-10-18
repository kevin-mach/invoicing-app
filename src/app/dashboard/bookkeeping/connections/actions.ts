"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireBookkeeper } from "@/lib/bookkeeping/access";
import { computeVatWorksheet } from "@/lib/bookkeeping/vat-return";
import { isProvider, providerConfig, type Provider } from "@/lib/integrations/config";
import { syncBank, listBankAccounts } from "@/lib/integrations/bank";
import { syncSquare } from "@/lib/integrations/square";
import { planPush, runPush, type PushPlan, type PushResult } from "@/lib/integrations/accounting";
import {
  buildHmrcPayload,
  fetchObligations,
  fraudHeaders,
  normaliseVrn,
  postReturn,
  type ClientFingerprint,
  type Obligation,
} from "@/lib/integrations/hmrc";
import { getAccessToken, getConnection, logSync } from "@/lib/integrations/store";

type Result<T = object> = ({ error: string } & Partial<Record<keyof T, never>>) | ({ error: null } & T);

const NOT_ALLOWED = "Only the owner or bookkeeper can do that.";
const refresh = () => revalidatePath("/dashboard/bookkeeping", "layout");

async function guard(provider: string) {
  const org = await requireBookkeeper();
  if (!org) return { error: NOT_ALLOWED } as const;
  if (!isProvider(provider)) return { error: "Unknown provider." } as const;
  if (provider === "hmrc" && org.role !== "owner") return { error: "Only the account owner can manage HMRC." } as const;
  return { org, provider } as { org: NonNullable<Awaited<ReturnType<typeof requireBookkeeper>>>; provider: Provider };
}

export async function disconnectProvider(provider: string): Promise<{ error: string | null }> {
  const g = await guard(provider);
  if ("error" in g) return { error: g.error };
  const admin = createAdminClient();
  const conn = await getConnection(g.org.orgId, g.provider);
  if (!conn) return { error: null };
  // Deleting the secrets is what actually revokes our access; the row stays for history.
  await admin.from("integration_secrets").delete().eq("connection_id", conn.id);
  await admin
    .from("integration_connections")
    .update({ status: "disconnected", last_error: null, expires_at: null, updated_at: new Date().toISOString() })
    .eq("id", conn.id);
  await logSync(g.org.orgId, g.provider, "disconnect", "ok", 0, "Disconnected");
  refresh();
  return { error: null };
}

export async function syncNow(provider: string): Promise<{ error: string | null; message?: string }> {
  const g = await guard(provider);
  if ("error" in g) return { error: g.error };
  try {
    if (g.provider === "truelayer") {
      const r = await syncBank(g.org.orgId);
      refresh();
      revalidatePath("/dashboard/bookkeeping/bank");
      return { error: null, message: `${r.inserted} new bank line${r.inserted === 1 ? "" : "s"}.` };
    }
    if (g.provider === "square") {
      const r = await syncSquare(g.org.orgId);
      refresh();
      return { error: null, message: `${r.days} day${r.days === 1 ? "" : "s"} of sales updated.` };
    }
    return { error: "This connection is sent manually — use the preview." };
  } catch (e) {
    refresh();
    return { error: e instanceof Error ? e.message : "Sync failed." };
  }
}

export async function saveProviderSettings(provider: string, input: Record<string, string>): Promise<{ error: string | null }> {
  const g = await guard(provider);
  if ("error" in g) return { error: g.error };
  const conn = await getConnection(g.org.orgId, g.provider);
  if (!conn) return { error: "Connect first." };
  const clean: Record<string, string> = {};
  for (const k of ["xeroSalesAccount", "xeroPurchaseAccount"]) {
    if (input[k] !== undefined) {
      const v = input[k].trim();
      if (v && !/^[A-Za-z0-9._-]{1,20}$/.test(v)) return { error: "Account codes can only contain letters, numbers, dots and dashes." };
      clean[k] = v;
    }
  }
  const admin = createAdminClient();
  await admin
    .from("integration_connections")
    .update({ settings: { ...((conn.settings as Record<string, string>) ?? {}), ...clean }, updated_at: new Date().toISOString() })
    .eq("id", conn.id);
  refresh();
  return { error: null };
}

export async function loadBankAccounts(): Promise<Result<{ accounts: { id: string; name: string; enabled: boolean }[] }>> {
  const g = await guard("truelayer");
  if ("error" in g) return { error: g.error };
  try {
    const conn = await getConnection(g.org.orgId, "truelayer");
    const disabled = new Set(((conn?.settings ?? {}) as { disabledAccounts?: string[] }).disabledAccounts ?? []);
    const accounts = await listBankAccounts(g.org.orgId);
    return { error: null, accounts: accounts.map((a) => ({ ...a, enabled: !disabled.has(a.id) })) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't load accounts." };
  }
}

export async function setBankAccountEnabled(accountId: string, enabled: boolean): Promise<{ error: string | null }> {
  const g = await guard("truelayer");
  if ("error" in g) return { error: g.error };
  const conn = await getConnection(g.org.orgId, "truelayer");
  if (!conn) return { error: "Connect first." };
  const settings = (conn.settings ?? {}) as { disabledAccounts?: string[] };
  const set = new Set(settings.disabledAccounts ?? []);
  if (enabled) set.delete(accountId);
  else set.add(accountId);
  await createAdminClient()
    .from("integration_connections")
    .update({ settings: { ...settings, disabledAccounts: [...set] }, updated_at: new Date().toISOString() })
    .eq("id", conn.id);
  refresh();
  return { error: null };
}

export async function previewPush(provider: string): Promise<Result<{ plan: PushPlan }>> {
  const g = await guard(provider);
  if ("error" in g) return { error: g.error };
  if (g.provider !== "xero" && g.provider !== "quickbooks") return { error: "Not an accounting connection." };
  try {
    return { error: null, plan: await planPush(g.org.orgId, g.provider) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't build the preview." };
  }
}

export async function pushDocuments(provider: string): Promise<Result<{ result: PushResult }>> {
  const g = await guard(provider);
  if ("error" in g) return { error: g.error };
  if (g.provider !== "xero" && g.provider !== "quickbooks") return { error: "Not an accounting connection." };
  try {
    const result = await runPush(g.org.orgId, g.provider);
    refresh();
    return { error: null, result };
  } catch (e) {
    refresh();
    return { error: e instanceof Error ? e.message : "Push failed." };
  }
}

/* ---------------------------------- HMRC ---------------------------------- */

async function hmrcContext(fp: ClientFingerprint) {
  const g = await guard("hmrc");
  if ("error" in g) return { ok: false, error: g.error } as const;
  const conn = await getConnection(g.org.orgId, "hmrc");
  if (!conn || conn.status === "disconnected") return { ok: false, error: "Connect HMRC first." } as const;
  const vrn = normaliseVrn(conn.account_id ?? g.org.vatNumber ?? "");
  if (!vrn) return { ok: false, error: "Enter your VAT registration number first." } as const;
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const fh = fraudHeaders(fp, { userId: g.org.userId, clientIp: forwarded || "0.0.0.0", clientPort: h.get("x-forwarded-port") ?? undefined });
  const { token } = await getAccessToken(g.org.orgId, "hmrc");
  const environment = providerConfig("hmrc").sandbox ? "sandbox" : "production";
  return { ok: true, g, vrn, fh, token, environment } as const;
}

export async function saveVrn(vrn: string): Promise<{ error: string | null }> {
  const g = await guard("hmrc");
  if ("error" in g) return { error: g.error };
  const clean = normaliseVrn(vrn);
  if (!clean) return { error: "A VAT number is 9 digits (a leading GB is fine)." };
  const conn = await getConnection(g.org.orgId, "hmrc");
  if (!conn) return { error: "Connect HMRC first." };
  await createAdminClient().from("integration_connections").update({ account_id: clean, updated_at: new Date().toISOString() }).eq("id", conn.id);
  refresh();
  return { error: null };
}

export async function loadObligations(fp: ClientFingerprint): Promise<Result<{ obligations: Obligation[]; submitted: string[]; environment: string }>> {
  try {
    const c = await hmrcContext(fp);
    if (!c.ok) return { error: c.error };
    const [obligations, { data: subs }] = await Promise.all([
      fetchObligations(c.vrn, c.token, c.fh),
      (await createClient()).from("vat_submissions").select("period_key").eq("org_id", c.g.org.orgId).eq("environment", c.environment),
    ]);
    return { error: null, obligations, submitted: (subs ?? []).map((s) => s.period_key), environment: c.environment };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't reach HMRC." };
  }
}

/** Boxes for an obligation period, always recomputed on the server from the obligation's own dates. */
export async function prepareReturn(fp: ClientFingerprint, periodKey: string): Promise<Result<{ payload: ReturnType<typeof buildHmrcPayload>; start: string; end: string; unaddedVat: number }>> {
  try {
    const c = await hmrcContext(fp);
    if (!c.ok) return { error: c.error };
    const ob = (await fetchObligations(c.vrn, c.token, c.fh)).find((o) => o.periodKey === periodKey);
    if (!ob) return { error: "HMRC has no such period." };
    const ws = await computeVatWorksheet(c.g.org.orgId, ob.start, ob.end);
    const unadded = new Set<string>();
    for (const l of ws.invoiceLines) if (l.vat > 0 && !l.vatOnTop) unadded.add(l.invoiceId);
    return { error: null, payload: buildHmrcPayload(periodKey, ws.box), start: ob.start, end: ob.end, unaddedVat: unadded.size };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't prepare the return." };
  }
}

export async function submitReturn(
  fp: ClientFingerprint,
  input: { periodKey: string; declared: boolean; confirmText: string; expected: Record<string, number> }
): Promise<Result<{ receipt: { processingDate?: string; formBundleNumber?: string } }>> {
  try {
    const c = await hmrcContext(fp);
    if (!c.ok) return { error: c.error };
    if (!input.declared) return { error: "Tick the declaration to submit." };
    if (c.environment === "production" && input.confirmText.trim().toUpperCase() !== "SUBMIT") {
      return { error: "Type SUBMIT to confirm this live submission." };
    }
    const ob = (await fetchObligations(c.vrn, c.token, c.fh)).find((o) => o.periodKey === input.periodKey);
    if (!ob) return { error: "HMRC has no such period." };
    if (ob.status === "F") return { error: "HMRC already has a return for this period." };

    const ws = await computeVatWorksheet(c.g.org.orgId, ob.start, ob.end);
    const payload = buildHmrcPayload(input.periodKey, ws.box);
    // Every box the person reviewed must match what's about to be sent, not just the net figure —
    // otherwise a change that happens to leave netVatDue unchanged (e.g. sales and purchases both
    // moving by the same amount) would slip through unnoticed.
    const changed = Object.entries(input.expected).some(([key, value]) => {
      const actual = payload[key as keyof typeof payload];
      return typeof actual === "number" && Math.abs(actual - value) > 0.005;
    });
    if (changed) {
      return { error: "Your figures changed since you reviewed them. Reload the return and check again." };
    }

    // Claim the period first: the unique key stops a double-click or second tab from filing twice.
    const admin = createAdminClient();
    const { data: claim, error: claimError } = await admin
      .from("vat_submissions")
      .insert({
        org_id: c.g.org.orgId,
        period_key: input.periodKey,
        period_start: ob.start,
        period_end: ob.end,
        environment: c.environment,
        boxes: payload,
        submitted_by: c.g.org.userId,
      })
      .select("id")
      .single();
    if (claimError || !claim) return { error: "This period has already been submitted (or is being submitted)." };

    try {
      const receipt = await postReturn(c.vrn, c.token, payload, c.fh);
      await admin.from("vat_submissions").update({ receipt }).eq("id", claim.id);
      await logSync(c.g.org.orgId, "hmrc", "vat_return", "ok", 1, `Submitted ${input.periodKey} (${c.environment})`);
      refresh();
      return { error: null, receipt };
    } catch (e) {
      await admin.from("vat_submissions").delete().eq("id", claim.id);
      const message = e instanceof Error ? e.message : "HMRC rejected the return.";
      await logSync(c.g.org.orgId, "hmrc", "vat_return", "error", 0, message);
      return { error: message };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Submission failed." };
  }
}
