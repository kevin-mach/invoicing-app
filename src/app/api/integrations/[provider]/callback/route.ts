import { NextResponse, type NextRequest } from "next/server";
import { requireBookkeeper } from "@/lib/bookkeeping/access";
import { isProvider, providerConfig } from "@/lib/integrations/config";
import { verifyState } from "@/lib/integrations/crypto";
import { apiFetch, exchangeCode, logSync, saveConnection } from "@/lib/integrations/store";

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const done = (key: "connected" | "error", msg: string) => {
    const url = new URL("/dashboard/bookkeeping/connections", request.url);
    url.searchParams.set(key, msg);
    const res = NextResponse.redirect(url);
    res.cookies.set("integ_state", "", { maxAge: 0, path: "/api/integrations" });
    return res;
  };
  if (!isProvider(provider)) return done("error", "Unknown provider.");
  const cfg = providerConfig(provider);

  const sp = request.nextUrl.searchParams;
  if (sp.get("error")) return done("error", `${cfg.name}: ${sp.get("error_description") ?? sp.get("error")}`);
  const code = sp.get("code");
  const state = sp.get("state");
  if (!code || !state) return done("error", "The provider didn't return an authorisation code.");

  // The state must be our own signature, unexpired, for this provider, tied to the browser that
  // started the flow (cookie) and to the user + organisation who are signed in right now.
  const parsed = verifyState(state);
  const org = await requireBookkeeper();
  const cookieNonce = request.cookies.get("integ_state")?.value;
  if (!parsed || parsed.provider !== provider || !cookieNonce || cookieNonce !== parsed.nonce) {
    return done("error", "That connection attempt expired or didn't start here. Try again.");
  }
  if (!org || org.userId !== parsed.userId || org.orgId !== parsed.orgId) {
    return done("error", "You were signed in as someone else. Try again.");
  }
  if (provider === "hmrc" && org.role !== "owner") return done("error", "Only the account owner can connect HMRC.");

  try {
    const tokens = await exchangeCode(provider, code);
    let accountId: string | null | undefined;
    let accountName: string | null | undefined;

    if (provider === "xero") {
      const tenants = (await apiFetch(`${cfg.apiUrl}/connections`, tokens.access_token)) as { tenantId: string; tenantName: string }[];
      if (!tenants?.length) return done("error", "Xero didn't share any organisation. Try again and tick one.");
      accountId = tenants[0].tenantId;
      accountName = tenants[0].tenantName;
    } else if (provider === "quickbooks") {
      accountId = sp.get("realmId");
      if (!accountId) return done("error", "QuickBooks didn't say which company was connected.");
      accountName = "QuickBooks company";
    } else if (provider === "square") {
      accountId = tokens.merchant_id ?? null;
      accountName = "Square account";
    } else if (provider === "hmrc") {
      accountId = null; // the VAT registration number is entered on the HMRC page
      accountName = "HMRC (VAT)";
    }

    await saveConnection(org.orgId, provider, tokens, { userId: org.userId, accountId, accountName, scopes: cfg.scope, settings: { environment: cfg.sandbox ? "sandbox" : "production" } });
    await logSync(org.orgId, provider, "connect", "ok", 0, "Connected");
    return done("connected", cfg.name);
  } catch (e) {
    return done("error", e instanceof Error ? e.message : "Couldn't finish connecting.");
  }
}
