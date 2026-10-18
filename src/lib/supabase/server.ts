import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/types";
import { capSessionCookies } from "@/lib/supabase/session-policy";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            // Caps the auth cookie to the 30-day "keep me signed in" window instead of whatever
            // lifetime Supabase's own client would otherwise give it — see session-policy.ts.
            for (const { name, value, options } of capSessionCookies(cookiesToSet, cookieStore)) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // called from a Server Component; middleware handles session refresh
          }
        },
      },
    }
  );
}
