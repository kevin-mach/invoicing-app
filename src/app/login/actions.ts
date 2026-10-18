"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { KEEP_SIGNED_IN_COOKIE, SESSION_STARTED_COOKIE, trackingCookieOptions } from "@/lib/supabase/session-policy";

export type AuthFormState = { error: string | null };

export async function login(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "").trim();
  const keepSignedIn = formData.get("keepSignedIn") === "on";

  const supabase = await createClient();

  // Stamped before signing in, so when Supabase writes its own auth cookie a moment later, the
  // policy in session-policy.ts already knows how long this browser should stay signed in for.
  const cookieStore = await cookies();
  cookieStore.set(KEEP_SIGNED_IN_COOKIE, keepSignedIn ? "1" : "0", trackingCookieOptions(keepSignedIn));
  cookieStore.set(SESSION_STARTED_COOKIE, String(Date.now()), trackingCookieOptions(keepSignedIn));

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}
