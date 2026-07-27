import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    const path = request.nextUrl.pathname;
    if (!path.startsWith("/login") && !path.startsWith("/register")) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      return NextResponse.redirect(redirectUrl);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute =
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/auth");

  // Guest review is intentionally public — exact `/review` and `/api/review`
  // prefixes only (SECURITY-AND-PERMISSIONS.md §4, TECHNICAL-ARCHITECTURE §3).
  // The route handlers under /api/review/* independently validate the guest
  // token via the service-role client; this only keeps the page reachable
  // without a TEMPO account.
  const isGuestReviewRoute =
    path === "/review" ||
    path.startsWith("/review/") ||
    path === "/api/review" ||
    path.startsWith("/api/review/");

  // Invite landing pages are public so an unauthenticated invitee can read
  // the preview and get routed to sign in; accepting itself still requires
  // an authenticated session (checked in the route handler) — see
  // SECURITY-AND-PERMISSIONS.md §4.
  const isInviteRoute =
    path === "/invite" ||
    path.startsWith("/invite/") ||
    path === "/api/invite" ||
    path.startsWith("/api/invite/");

  if (!user && !isAuthRoute && !isGuestReviewRoute && !isInviteRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (path.startsWith("/login") || path.startsWith("/register"))) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
