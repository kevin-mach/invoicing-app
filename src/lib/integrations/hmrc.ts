import { roundMoney } from "@/lib/format";
import type { VatReturn } from "@/lib/bookkeeping/vat";
import { providerConfig } from "./config";
import { apiFetch } from "./store";

export type Obligation = { periodKey: string; start: string; end: string; due: string; status: "O" | "F"; received?: string };

/** What the browser can tell us for HMRC's fraud-prevention headers. The rest (IP, user id,
 * vendor details) is added on the server. */
export type ClientFingerprint = {
  deviceId: string;
  userAgent: string;
  timezone: string; // "UTC+01:00"
  screen: string; // "width=1920&height=1080&scaling-factor=1&colour-depth=24"
  window: string; // "width=1200&height=800"
};

export function normaliseVrn(raw: string): string | null {
  const v = raw.replace(/\s+/g, "").replace(/^GB/i, "");
  return /^\d{9}$/.test(v) ? v : null;
}

const MEDIA = "application/vnd.hmrc.1.0+json";

export function fraudHeaders(fp: ClientFingerprint, ctx: { userId: string; clientIp: string; clientPort?: string }): Record<string, string> {
  const enc = encodeURIComponent;
  return {
    "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",
    "Gov-Client-Browser-JS-User-Agent": fp.userAgent,
    "Gov-Client-Device-ID": fp.deviceId,
    "Gov-Client-Multi-Factor": "",
    "Gov-Client-Public-IP": ctx.clientIp,
    "Gov-Client-Public-IP-Timestamp": new Date().toISOString().replace(/(\.\d{3})Z$/, "$1Z"),
    ...(ctx.clientPort ? { "Gov-Client-Public-Port": ctx.clientPort } : {}),
    "Gov-Client-Screens": fp.screen,
    "Gov-Client-Timezone": fp.timezone,
    "Gov-Client-User-IDs": `8club=${enc(ctx.userId)}`,
    "Gov-Client-Window-Size": fp.window,
    "Gov-Vendor-Product-Name": enc("8 Club Invoicing"),
    "Gov-Vendor-Version": `8club-invoicing=1.0.0`,
  };
}

export async function fetchObligations(vrn: string, token: string, headers: Record<string, string>): Promise<Obligation[]> {
  const cfg = providerConfig("hmrc");
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
  const res = (await apiFetch(`${cfg.apiUrl}/organisations/vat/${vrn}/obligations?from=${from}&to=${to}`, token, {
    headers: { Accept: MEDIA, ...headers },
  })) as { obligations?: Obligation[] };
  return (res.obligations ?? []).sort((a, b) => (a.start < b.start ? 1 : -1));
}

/** Maps our five boxes onto HMRC's return payload. Boxes 1–5 are pounds and pence; boxes 6–9 are
 * whole pounds, which HMRC requires (so the net/purchase totals are truncated, not rounded). */
export function buildHmrcPayload(periodKey: string, box: VatReturn) {
  const vatDueSales = roundMoney(box.box1);
  const reclaimed = roundMoney(box.box4);
  const totalVatDue = vatDueSales;
  return {
    periodKey,
    vatDueSales,
    vatDueAcquisitions: 0,
    totalVatDue,
    vatReclaimedCurrPeriod: reclaimed,
    netVatDue: roundMoney(Math.abs(totalVatDue - reclaimed)),
    totalValueSalesExVAT: Math.trunc(box.box6),
    totalValuePurchasesExVAT: Math.trunc(box.box7),
    totalValueGoodsSuppliedExVAT: 0,
    totalAcquisitionsExVAT: 0,
    finalised: true,
  };
}

export async function postReturn(vrn: string, token: string, payload: ReturnType<typeof buildHmrcPayload>, headers: Record<string, string>) {
  const cfg = providerConfig("hmrc");
  return (await apiFetch(`${cfg.apiUrl}/organisations/vat/${vrn}/returns`, token, {
    method: "POST",
    headers: { Accept: MEDIA, "Content-Type": "application/json", ...headers },
    body: JSON.stringify(payload),
  })) as { processingDate?: string; paymentIndicator?: string; formBundleNumber?: string; chargeRefNumber?: string };
}
