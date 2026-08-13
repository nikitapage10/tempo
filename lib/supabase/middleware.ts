import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasAcceptedCurrentLegalTerms } from "@/lib/legal";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    const path = request.nextUrl.pathname;
    if (
      !path.startsWith("/login") &&
      !path.startsWith("/register") &&
      !path.startsWith("/forgot-password") &&
      !path.startsWith("/terms") &&
      !path.startsWith("/privacy") &&
      path !== "/download" &&
      !path.startsWith("/download/") &&
      !path.startsWith("/api/desktop")
    ) {
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
    path.startsWith("/forgot-password") ||
    path.startsWith("/auth");

  const isLegalRoute =
    path === "/terms" ||
    path === "/privacy" ||
    path === "/legal/accept";

  // Password reset lands here after the email link exchanges a session.
  const isResetPasswordRoute = path.startsWith("/reset-password");
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
    path.startsWith("/api/invite/") ||
    // Artist-level team invites (managers, agents, tour managers) — same
    // public-preview-then-authenticated-accept shape as the track invite
    // route above, just against a different table.
    path === "/team-invite" ||
    path.startsWith("/team-invite/") ||
    path === "/api/team-invite" ||
    path.startsWith("/api/team-invite/");

  // The account-creation invite-code check runs before anyone has a
  // session — it has to be reachable from the (public) /register form.
  const isInviteCodeCheckRoute =
    path === "/api/auth/verify-invite" || path === "/api/auth/redeem-invite";

  // Public artist profiles — exact `/p` and `/api/p` prefixes only, mirroring
  // the guest-review/invite pattern above. The route handler independently
  // re-checks `visibility = 'public'` via the service-role client (see
  // lib/public-profile-server.ts); this only keeps the page reachable
  // without a TEMPO account. A loose match here would open the whole app.
  const isPublicProfileRoute =
    path === "/p" ||
    path.startsWith("/p/") ||
    path === "/api/p" ||
    path.startsWith("/api/p/");

  // Published Scene pages and Scene invite previews must be reachable before
  // sign-in. Their server/data layers still enforce visibility and token
  // validity; this exemption only lets visitors reach those guarded surfaces.
  const isPublicSceneRoute =
    path === "/s" ||
    path.startsWith("/s/") ||
    path === "/scene/invite" ||
    path.startsWith("/scene/invite/");

  // Token-scoped, no-sign-in email unsubscribe (AR-6). Exact prefix only,
  // mirroring the guest-review/invite/public-profile pattern above. The
  // route handler independently validates the hashed token and can only
  // disable optional email — it cannot read or change anything else.
  const isEmailUnsubscribeRoute = path.startsWith("/api/email/unsubscribe/");

  // Desktop download page + installer redirects — invite email and shared
  // Download links must work before sign-in. Installer probes only redirect
  // to the public release channel or the bundled Windows beta.
  const isDesktopDownloadRoute =
    path === "/download" ||
    path.startsWith("/download/") ||
    path === "/api/desktop" ||
    path.startsWith("/api/desktop/");

  // Server-to-server routes that authorize themselves (CRON_SECRET header
  // or a provider webhook signature) rather than a member session — a
  // scheduled invoker or a webhook provider never has a TEMPO cookie, so
  // without this exemption every call would be redirected to /login before
  // the route's own check ever ran (discovered via AR-6's E2E tests; this
  // silently affected the pre-existing catalog-snapshots cron too).
  const isServerAuthorizedRoute =
    path.startsWith("/api/cron/") || path.startsWith("/api/webhooks/");

  // Local test sign-in. Reachable without a session for the obvious reason —
  // creating one is its entire job. Gated here on NODE_ENV so the path is not
  // even exempt in a deployed build, and gated again on NODE_ENV, a loopback
  // host and DEV_TEST_EMAIL inside the handler. See app/api/dev/session.
  const isDevSessionRoute =
    process.env.NODE_ENV === "development" && path === "/api/dev/session";

  if (
    !user &&
    !isAuthRoute &&
    !isLegalRoute &&
    !isResetPasswordRoute &&
    !isGuestReviewRoute &&
    !isInviteRoute &&
    !isInviteCodeCheckRoute &&
    !isPublicProfileRoute &&
    !isPublicSceneRoute &&
    !isEmailUnsubscribeRoute &&
    !isDesktopDownloadRoute &&
    !isServerAuthorizedRoute &&
    !isDevSessionRoute
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  // Recovery sessions need /reset-password; don't bounce them to Today.
  if (
    user &&
    (path.startsWith("/login") ||
      path.startsWith("/register") ||
      path.startsWith("/forgot-password"))
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    return NextResponse.redirect(redirectUrl);
  }

  // New email signups accept during registration. Existing members and anyone
  // whose account was created through an identity provider accept here once.
  // Only page navigations are redirected; API routes keep their normal auth and
  // error behavior, and public profiles/reviews/scenes remain public.
  // Client-side Next.js navigations request an RSC payload rather than HTML,
  // so recognize both forms while leaving manifests and media requests alone.
  const isPageNavigation =
    request.method === "GET" &&
    ((request.headers.get("accept") ?? "").includes("text/html") ||
      request.headers.has("rsc"));
  const isPublicExperience =
    isGuestReviewRoute ||
    isInviteRoute ||
    isPublicProfileRoute ||
    isPublicSceneRoute ||
    isDesktopDownloadRoute;

  if (
    user &&
    isPageNavigation &&
    !hasAcceptedCurrentLegalTerms(user) &&
    !isLegalRoute &&
    !isAuthRoute &&
    !isResetPasswordRoute &&
    !isPublicExperience
  ) {
    const redirectUrl = request.nextUrl.clone();
    const next = `${path}${request.nextUrl.search}`;
    redirectUrl.pathname = "/legal/accept";
    redirectUrl.search = `?next=${encodeURIComponent(next)}`;
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
