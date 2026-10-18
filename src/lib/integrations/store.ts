import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import { decrypt, encrypt } from "./crypto";
import { providerConfig, redirectUri, type Provider } from "./config";

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: string;
  merchant_id?: string;
};

async function tokenRequest(provider: Provider, params: Record<string, string>): Promise<TokenResponse> {
  const cfg = providerConfig(provider);
  if (!cfg.clientId || !cfg.clientSecret) throw new Error(`${cfg.name} isn't configured on this server.`);
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: string;

  if (provider === "square") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({ client_id: cfg.clientId, client_secret: cfg.clientSecret, ...params });
  } else {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    const form = new URLSearchParams(params);
    if (cfg.tokenAuth === "basic") {
      headers.Authorization = `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64")}`;
    } else {
      form.set("client_id", cfg.clientId);
      form.set("client_secret", cfg.clientSecret);
    }
    body = form.toString();
  }

  const res = await fetch(cfg.tokenUrl, { method: "POST", headers, body, cache: "no-store" });
  if (!res.ok) throw new Error(`${cfg.name} token request failed (${res.status}).`);
  const json = (await res.json()) as TokenResponse;
  if (!json.access_token) throw new Error(`${cfg.name} returned no access token.`);
  return json;
}

export function exchangeCode(provider: Provider, code: string) {
  return tokenRequest(provider, { grant_type: "authorization_code", code, redirect_uri: redirectUri(provider) });
}

function expiryOf(t: TokenResponse): string | null {
  if (t.expires_at) return new Date(t.expires_at).toISOString();
  if (t.expires_in) return new Date(Date.now() + t.expires_in * 1000).toISOString();
  return null;
}

/** Creates or updates the connection row and stores its tokens encrypted. */
export async function saveConnection(
  orgId: string,
  provider: Provider,
  tokens: TokenResponse,
  extra: { userId?: string; accountId?: string | null; accountName?: string | null; scopes?: string; settings?: Record<string, Json> } = {}
) {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("integration_connections")
    .select("id, settings")
    .eq("org_id", orgId)
    .eq("provider", provider)
    .maybeSingle();

  const fields = {
    status: "connected",
    last_error: null,
    expires_at: expiryOf(tokens),
    ...(extra.accountId !== undefined ? { account_id: extra.accountId } : {}),
    ...(extra.accountName !== undefined ? { account_name: extra.accountName } : {}),
    ...(extra.scopes ? { scopes: extra.scopes } : {}),
    settings: { ...((existing?.settings as Record<string, Json> | null) ?? {}), ...(extra.settings ?? {}) } as Json,
    updated_at: new Date().toISOString(),
  };

  let id = existing?.id;
  if (id) {
    await admin.from("integration_connections").update(fields).eq("id", id);
  } else {
    const { data, error } = await admin
      .from("integration_connections")
      .insert({ org_id: orgId, provider, connected_by: extra.userId ?? null, ...fields })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Could not save the connection.");
    id = data.id;
  }

  const { data: prev } = await admin.from("integration_secrets").select("refresh_token").eq("connection_id", id).maybeSingle();
  await admin.from("integration_secrets").upsert({
    connection_id: id,
    access_token: encrypt(tokens.access_token),
    // Providers only send a refresh token on some responses; keep the old one if none came back.
    refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : (prev?.refresh_token ?? null),
    updated_at: new Date().toISOString(),
  });
  return id;
}

export async function getConnection(orgId: string, provider: Provider) {
  const admin = createAdminClient();
  const { data } = await admin.from("integration_connections").select("*").eq("org_id", orgId).eq("provider", provider).maybeSingle();
  return data;
}

export async function markError(connectionId: string, message: string) {
  const admin = createAdminClient();
  await admin
    .from("integration_connections")
    .update({ status: "error", last_error: message.slice(0, 300), updated_at: new Date().toISOString() })
    .eq("id", connectionId);
}

/** Returns a usable access token, refreshing it (and storing the rotated refresh token) if it
 * expires within a minute. Throws — after flagging the connection — when the link is broken. */
export async function getAccessToken(orgId: string, provider: Provider): Promise<{ token: string; connection: NonNullable<Awaited<ReturnType<typeof getConnection>>> }> {
  const admin = createAdminClient();
  const connection = await getConnection(orgId, provider);
  if (!connection || connection.status === "disconnected") throw new Error("Not connected.");

  const { data: secret } = await admin.from("integration_secrets").select("*").eq("connection_id", connection.id).maybeSingle();
  if (!secret) throw new Error("Connection has no stored credentials — reconnect.");

  const expiring = connection.expires_at ? new Date(connection.expires_at).getTime() - Date.now() < 60_000 : false;
  if (!expiring && connection.status === "connected") return { token: decrypt(secret.access_token), connection };
  if (!expiring && connection.status === "error" && !secret.refresh_token) throw new Error(connection.last_error ?? "Connection error.");

  if (!secret.refresh_token) {
    if (!expiring) return { token: decrypt(secret.access_token), connection };
    await markError(connection.id, "Session expired — reconnect.");
    throw new Error("Session expired — reconnect.");
  }
  try {
    const fresh = await tokenRequest(provider, { grant_type: "refresh_token", refresh_token: decrypt(secret.refresh_token) });
    await saveConnection(orgId, provider, fresh);
    return { token: fresh.access_token, connection: { ...connection, status: "connected" } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Refresh failed.";
    await markError(connection.id, `${msg} Reconnect to continue.`);
    throw new Error(msg);
  }
}

export async function logSync(orgId: string, provider: Provider, kind: string, status: "ok" | "error", itemCount: number, message?: string) {
  const admin = createAdminClient();
  await admin.from("sync_logs").insert({ org_id: orgId, provider, kind, status, item_count: itemCount, message: message?.slice(0, 500) ?? null });
  if (status === "ok") {
    await admin
      .from("integration_connections")
      .update({ last_synced_at: new Date().toISOString(), last_error: null })
      .eq("org_id", orgId)
      .eq("provider", provider);
  } else {
    await admin.from("integration_connections").update({ last_error: message?.slice(0, 300) ?? "Sync failed" }).eq("org_id", orgId).eq("provider", provider);
  }
}

export async function apiFetch(url: string, token: string, init: RequestInit & { headers?: Record<string, string> } = {}): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const detail = typeof json === "object" && json ? JSON.stringify(json).slice(0, 300) : text.slice(0, 200);
    throw new Error(`Request failed (${res.status}): ${detail}`);
  }
  return json;
}
