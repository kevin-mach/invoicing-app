import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup");
  // Invite links land here with the session token in the URL fragment, which the server
  // never sees — the client establishes the session after this request completes.
  const isInviteRoute = request.nextUrl.pathname.startsWith("/invite");
  // Stripe calls this server-to-server with no session cookie — never gate it.
  const isStripeWebhook = request.nextUrl.pathname.startsWith("/api/stripe/webhook");

  if (!user && !isAuthRoute && !isInviteRoute && !isStripeWebhook && request.nextUrl.pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Bookkeepers can only view Reports; everyone else (besides the owner) is kept out of it.
  if (user && request.nextUrl.pathname.startsWith("/dashboard")) {
    const { data: membership } = await supabase
      .from("org_members")
      .select("role")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    const role = membership?.role;
    const isReportsRoute =
      request.nextUrl.pathname === "/dashboard/reports" ||
      request.nextUrl.pathname.startsWith("/dashboard/reports/");

    if (role === "bookkeeper" && !isReportsRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard/reports";
      return NextResponse.redirect(url);
    }

    if (role && role !== "owner" && role !== "bookkeeper" && isReportsRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw\\.js|offline\\.html|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
