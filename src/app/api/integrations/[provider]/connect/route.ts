import { NextResponse, type NextRequest } from "next/server";
import { requireBookkeeper } from "@/lib/bookkeeping/access";
import { isConfigured, isProvider, providerConfig, redirectUri } from "@/lib/integrations/config";
import { encryptionConfigured, signState } from "@/lib/integrations/crypto";

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const back = (msg: string) => {
    const url = new URL("/dashboard/bookkeeping/connections", request.url);
    url.searchParams.set("error", msg);
    return NextResponse.redirect(url);
  };
  if (!isProvider(provider)) return back("Unknown provider.");

  const org = await requireBookkeeper();
  if (!org) return NextResponse.redirect(new URL("/dashboard", request.url));
  if (provider === "hmrc" && org.role !== "owner") return back("Only the account owner can connect HMRC.");

  const cfg = providerConfig(provider);
  if (!isConfigured(cfg) || !encryptionConfigured()) return back(`${cfg.name} isn't set up on this server yet.`);

  const { state, nonce } = signState(org.orgId, org.userId, provider);
  const url = new URL(cfg.authUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", cfg.clientId!);
  url.searchParams.set("redirect_uri", redirectUri(provider));
  url.searchParams.set("scope", cfg.scope);
  url.searchParams.set("state", state);
  for (const [k, v] of Object.entries(cfg.authParams)) url.searchParams.set(k, v);

  const res = NextResponse.redirect(url);
  res.cookies.set("integ_state", nonce, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/api/integrations" });
  return res;
}
