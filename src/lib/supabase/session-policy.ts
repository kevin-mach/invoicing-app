/** "Keep me signed in": caps how long a browser stays logged in.
 *
 * Supabase's own refresh token would otherwise keep a session alive indefinitely — as long as the
 * app keeps refreshing it, there's no built-in expiry. These two cookies add one: `session_started_at`
 * records when the current browser session began, and `keep_signed_in` records whether the login
 * checkbox was ticked. Every time Supabase's client writes its own auth cookies (login, token
 * refresh), `capSessionCookies` clamps their lifetime to whatever's left of the 30-day window, and
 * strips it to a browser-session cookie entirely when "keep me signed in" wasn't ticked. Once the
 * window's up, `isSessionExpired` tells the proxy to sign the browser out on its next visit.
 */

export const SESSION_STARTED_COOKIE = "session_started_at";
export const KEEP_SIGNED_IN_COOKIE = "keep_signed_in";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type CookieToSet = { name: string; value: string; options: Record<string, unknown> };
export type CookieReader = { get(name: string): { value: string } | undefined };

export function isProdCookie(): boolean {
  return process.env.NODE_ENV === "production";
}

export function trackingCookieOptions(keepSignedIn: boolean): Record<string, unknown> {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProdCookie(),
    path: "/",
    ...(keepSignedIn ? { maxAge: SESSION_MAX_AGE_SECONDS } : {}),
  };
}

/** True once more than 30 days have passed since `session_started_at` was stamped. A missing
 * stamp is never treated as expired — it just hasn't been set yet (e.g. a session from before
 * this feature shipped, or one established outside the login form, like signup or an invite
 * link) — the proxy stamps it fresh the moment it sees an authenticated request without one. */
export function isSessionExpired(reader: CookieReader): boolean {
  const raw = reader.get(SESSION_STARTED_COOKIE)?.value;
  if (!raw) return false;
  const startedAt = Number(raw);
  if (!Number.isFinite(startedAt)) return false;
  return Date.now() - startedAt > SESSION_MAX_AGE_SECONDS * 1000;
}

/** Rewrites Supabase's own auth-cookie writes so they never outlive the 30-day window, and are
 * plain (non-persistent) browser-session cookies when "keep me signed in" wasn't ticked. Cookies
 * being *cleared* (maxAge 0, e.g. by signOut) are passed through untouched — capping only applies
 * to cookies actually being set or refreshed. */
export function capSessionCookies(cookiesToSet: CookieToSet[], reader: CookieReader): CookieToSet[] {
  const keepSignedIn = reader.get(KEEP_SIGNED_IN_COOKIE)?.value !== "0";
  const startedRaw = reader.get(SESSION_STARTED_COOKIE)?.value;
  const startedAt = startedRaw && Number.isFinite(Number(startedRaw)) ? Number(startedRaw) : Date.now();
  const remainingSeconds = Math.max(0, Math.floor((startedAt + SESSION_MAX_AGE_SECONDS * 1000 - Date.now()) / 1000));

  return cookiesToSet.map((c) => {
    if (!c.name.startsWith("sb-")) return c;
    if (c.options.maxAge === 0) return c; // an explicit clear — leave it alone

    const { expires: _expires, maxAge: _maxAge, ...rest } = c.options;
    if (!keepSignedIn) return { ...c, options: rest }; // session cookie: gone when the browser closes
    return { ...c, options: { ...rest, maxAge: remainingSeconds } };
  });
}
