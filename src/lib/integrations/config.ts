export const PROVIDERS = ["truelayer", "square", "xero", "quickbooks", "hmrc"] as const;
export type Provider = (typeof PROVIDERS)[number];

export function isProvider(v: string): v is Provider {
  return (PROVIDERS as readonly string[]).includes(v);
}

export type ProviderConfig = {
  provider: Provider;
  name: string;
  purpose: string;
  authUrl: string;
  tokenUrl: string;
  apiUrl: string;
  scope: string;
  /** How the client authenticates at the token endpoint. */
  tokenAuth: "basic" | "body";
  /** Extra query parameters for the authorize redirect. */
  authParams: Record<string, string>;
  clientId?: string;
  clientSecret?: string;
  sandbox: boolean;
  beta?: boolean;
  envVars: string[];
};

const env = (k: string) => process.env[k] || undefined;

/** Every URL can be overridden by env (`<PROVIDER>_AUTH_URL` etc.), which is how a mock server
 * stands in during testing and how sandbox/production is chosen. */
export function providerConfig(provider: Provider): ProviderConfig {
  const P = provider.toUpperCase();
  const sandbox = (env(`${P}_ENV`) ?? "sandbox") !== "production";
  const o = (kind: string, fallback: string) => env(`${P}_${kind}_URL`) ?? fallback;
  const vars = [`${P}_CLIENT_ID`, `${P}_CLIENT_SECRET`, `${P}_ENV`];
  const base = { provider, sandbox, clientId: env(`${P}_CLIENT_ID`), clientSecret: env(`${P}_CLIENT_SECRET`), envVars: vars };

  switch (provider) {
    case "truelayer":
      return {
        ...base,
        name: "Bank feed (Open Banking)",
        purpose: "Pull bank transactions in automatically every day via TrueLayer.",
        authUrl: o("AUTH", sandbox ? "https://auth.truelayer-sandbox.com" : "https://auth.truelayer.com"),
        tokenUrl: o("TOKEN", `${sandbox ? "https://auth.truelayer-sandbox.com" : "https://auth.truelayer.com"}/connect/token`),
        apiUrl: o("API", sandbox ? "https://api.truelayer-sandbox.com" : "https://api.truelayer.com"),
        scope: "info accounts balance transactions offline_access",
        tokenAuth: "body",
        authParams: { providers: sandbox ? "uk-cs-mock" : "uk-ob-all uk-oauth-all" },
      };
    case "square":
      return {
        ...base,
        name: "Square POS",
        purpose: "Import daily sales, VAT and takings from Square automatically.",
        authUrl: o("AUTH", `${sandbox ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com"}/oauth2/authorize`),
        tokenUrl: o("TOKEN", `${sandbox ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com"}/oauth2/token`),
        apiUrl: o("API", sandbox ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com"),
        scope: "ORDERS_READ PAYMENTS_READ MERCHANT_PROFILE_READ",
        tokenAuth: "body",
        authParams: { session: "false" },
      };
    case "xero":
      return {
        ...base,
        name: "Xero",
        purpose: "Send your invoices and supplier bills to Xero.",
        authUrl: o("AUTH", "https://login.xero.com/identity/connect/authorize"),
        tokenUrl: o("TOKEN", "https://identity.xero.com/connect/token"),
        apiUrl: o("API", "https://api.xero.com"),
        // Xero has been moving to granular scopes; override without a redeploy if needed.
        scope: env("XERO_SCOPES") ?? "offline_access accounting.transactions accounting.contacts accounting.settings.read",
        tokenAuth: "basic",
        authParams: {},
      };
    case "quickbooks":
      return {
        ...base,
        name: "QuickBooks Online",
        purpose: "Send your invoices and supplier bills to QuickBooks.",
        beta: true,
        authUrl: o("AUTH", "https://appcenter.intuit.com/connect/oauth2"),
        tokenUrl: o("TOKEN", "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"),
        apiUrl: o("API", sandbox ? "https://sandbox-quickbooks.api.intuit.com" : "https://quickbooks.api.intuit.com"),
        scope: "com.intuit.quickbooks.accounting",
        tokenAuth: "basic",
        authParams: {},
      };
    case "hmrc":
      return {
        ...base,
        name: "HMRC — Making Tax Digital (VAT)",
        purpose: "Submit your VAT return straight to HMRC.",
        authUrl: o("AUTH", `${sandbox ? "https://test-www.tax.service.gov.uk" : "https://www.tax.service.gov.uk"}/oauth/authorize`),
        tokenUrl: o("TOKEN", `${sandbox ? "https://test-api.service.hmrc.gov.uk" : "https://api.service.hmrc.gov.uk"}/oauth/token`),
        apiUrl: o("API", sandbox ? "https://test-api.service.hmrc.gov.uk" : "https://api.service.hmrc.gov.uk"),
        scope: "read:vat write:vat",
        tokenAuth: "body",
        authParams: {},
      };
  }
}

export function isConfigured(p: ProviderConfig): boolean {
  return Boolean(p.clientId && p.clientSecret);
}

export function redirectUri(provider: Provider): string {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200").replace(/\/$/, "");
  return `${site}/api/integrations/${provider}/callback`;
}
