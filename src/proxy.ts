import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  capSessionCookies,
  isSessionExpired,
  KEEP_SIGNED_IN_COOKIE,
  SESSION_STARTED_COOKIE,
  trackingCookieOptions,
} from "@/lib/supabase/session-policy";

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
          // Caps the auth cookie to the 30-day "keep me signed in" window — see session-policy.ts.
          for (const { name, value, options } of capSessionCookies(cookiesToSet, request.cookies)) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // More than 30 days since this browser last signed in: sign it out here, before anything else
  // reads the (still technically valid, per Supabase) session. getUser() below then correctly
  // sees no session and the existing "not signed in" redirect below takes it from there.
  if (isSessionExpired(request.cookies)) {
    await supabase.auth.signOut();
    supabaseResponse.cookies.delete(SESSION_STARTED_COOKIE);
    supabaseResponse.cookies.delete(KEEP_SIGNED_IN_COOKIE);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No stamp yet on an authenticated request — a session from before this feature shipped, or
  // one established outside the login form (signup, an invite link). Start its 30-day clock now.
  if (user && !request.cookies.get(SESSION_STARTED_COOKIE)) {
    supabaseResponse.cookies.set(SESSION_STARTED_COOKIE, String(Date.now()), trackingCookieOptions(true));
    supabaseResponse.cookies.set(KEEP_SIGNED_IN_COOKIE, "1", trackingCookieOptions(true));
  }

  const isAuthRoute = request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup");
  // Invite links land here with the session token in the URL fragment, which the server
  // never sees — the client establishes the session after this request completes.
  const isInviteRoute = request.nextUrl.pathname.startsWith("/invite");
  // Stripe calls this server-to-server with no session cookie — never gate it.
  const isStripeWebhook =
    request.nextUrl.pathname.startsWith("/api/stripe/webhook") ||
    request.nextUrl.pathname.startsWith("/api/cron/");
  const isDashboardRoute = request.nextUrl.pathname.startsWith("/dashboard");
  const isCustomerPortalRoute = request.nextUrl.pathname.startsWith("/customer-portal");
  const isSupplierPortalRoute = request.nextUrl.pathname.startsWith("/supplier-portal");

  if (!user && !isAuthRoute && !isInviteRoute && !isStripeWebhook && request.nextUrl.pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    // Courier org members always land on /dashboard, exactly as before. Only a user with
    // no org membership is checked against the customer portal, so this is a pure addition —
    // every existing courier login follows the same first branch it always has.
    const { data: orgMembership } = await supabase
      .from("org_members")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    const url = request.nextUrl.clone();
    if (orgMembership) {
      url.pathname = "/dashboard";
    } else {
      const { data: customerMembership } = await supabase
        .from("customer_members")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (customerMembership) {
        url.pathname = "/customer-portal";
      } else {
        const { data: vendorMembership } = await supabase
          .from("vendor_members")
          .select("id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();
        url.pathname = vendorMembership ? "/supplier-portal" : "/dashboard";
      }
    }
    return NextResponse.redirect(url);
  }

  // Bookkeepers can only view Reports; everyone else (besides the owner) is kept out of it.
  if (user && isDashboardRoute) {
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

    const isBookkeepingRoute =
      request.nextUrl.pathname === "/dashboard/bookkeeping" ||
      request.nextUrl.pathname.startsWith("/dashboard/bookkeeping/");

    // Bookkeepers get Reports plus the Bookkeeping module; anything else sends them there.
    const isOpsRoute =
      request.nextUrl.pathname.startsWith("/dashboard/cash-up") ||
      request.nextUrl.pathname.startsWith("/dashboard/stock");
    if (role === "bookkeeper" && !isReportsRoute && !isBookkeepingRoute && !isOpsRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard/bookkeeping";
      return NextResponse.redirect(url);
    }

    if (role && role !== "owner" && role !== "bookkeeper" && (isReportsRoute || isBookkeepingRoute)) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // No courier membership at all — if this user is actually a customer- or supplier-portal
    // member, send them home instead of falling into the dashboard's onboarding redirect.
    if (!membership) {
      const { data: customerMembership } = await supabase
        .from("customer_members")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (customerMembership) {
        const url = request.nextUrl.clone();
        url.pathname = "/customer-portal";
        return NextResponse.redirect(url);
      }

      const { data: vendorMembership } = await supabase
        .from("vendor_members")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (vendorMembership) {
        const url = request.nextUrl.clone();
        url.pathname = "/supplier-portal";
        return NextResponse.redirect(url);
      }
    }
  }

  if (user && isCustomerPortalRoute) {
    const { data: customerMembership } = await supabase
      .from("customer_members")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!customerMembership) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  if (user && isSupplierPortalRoute) {
    const { data: vendorMembership } = await supabase
      .from("vendor_members")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!vendorMembership) {
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
