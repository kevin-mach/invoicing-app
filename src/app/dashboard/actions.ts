"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { KEEP_SIGNED_IN_COOKIE, SESSION_STARTED_COOKIE } from "@/lib/supabase/session-policy";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_STARTED_COOKIE);
  cookieStore.delete(KEEP_SIGNED_IN_COOKIE);
  redirect("/login");
}
