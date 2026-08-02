import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Local-only sign-in for a seeded test user.
 *
 * Exists so an automated browser (or anyone doing UI work) can reach the
 * authenticated screens without a password ever being typed into the login
 * form. It mints a one-time magic-link token through the service-role admin
 * API and redeems it server-side, which sets the ordinary Supabase session
 * cookies — the session that comes out is a completely normal one.
 *
 * This must never be reachable in production. Three independent gates:
 *
 *   1. NODE_ENV must be "development". Vercel builds are "production", so the
 *      route 404s there even though the file ships.
 *   2. The request host must be loopback. Covers a production-mode `next start`
 *      or a tunnel pointed at a dev server.
 *   3. DEV_TEST_EMAIL must be set, and it only lives in .env.local — which is
 *      gitignored and is not set in Vercel.
 *
 * Any one of them failing returns a bare 404, not an explanation: a probe on a
 * deployed host should not be able to tell this route apart from a typo.
 *
 * Usage:
 *   /api/dev/session                  → signs in, lands on Today
 *   /api/dev/session?next=/tracks     → signs in, lands anywhere you like
 *   /api/dev/session?next=/origin%3Freplay%3D1
 *
 * The test user is created on first use if it doesn't exist yet, so there is
 * no manual setup beyond the env var. It is an ordinary row in your own
 * Supabase project's auth schema — delete it from Auth → Users whenever you
 * want to start it over.
 */

export const dynamic = "force-dynamic";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** A bare 404, indistinguishable from a route that isn't there. */
function notFound() {
  return new NextResponse(null, { status: 404 });
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") return notFound();

  const url = new URL(request.url);
  if (!LOOPBACK.has(url.hostname)) return notFound();

  const email = process.env.DEV_TEST_EMAIL;
  if (!email) return notFound();

  // Relative paths only — an absolute `next` would turn this into an open
  // redirect the moment one of the gates above is ever loosened.
  const requested = url.searchParams.get("next") ?? "/";
  const next = requested.startsWith("/") && !requested.startsWith("//")
    ? requested
    : "/";

  // Already signed in as the test user — nothing to do but go where you asked.
  // This is the common case on every call after the first, and skipping the
  // token dance avoids GoTrue's rate limit on link generation, which hands back
  // a token that has already been spent and then rejects it as expired.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email?.toLowerCase() === email.toLowerCase()) {
    return NextResponse.redirect(new URL(next, url.origin));
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is missing from .env.local." },
      { status: 500 }
    );
  }

  // generateLink refuses an address it has never seen, so seed it first. A
  // random password nobody is told: sign-in here only ever goes through the
  // token below, and leaving it unset would make the row unusable elsewhere.
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { dev_test_user: true },
  });
  // "already registered" is the expected path on every run after the first.
  if (createError && !/already/i.test(createError.message)) {
    return NextResponse.json(
      { error: `Could not seed ${email}: ${createError.message}` },
      { status: 500 }
    );
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    return NextResponse.json(
      { error: error?.message ?? "No token was returned for that address." },
      { status: 500 }
    );
  }

  // Redeemed through the cookie-writing SSR client, so what lands in the
  // browser is the same session a real sign-in would have produced. The type
  // has to match what the link was generated as — "email" verifies against a
  // confirmation token and rejects this one as expired.
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  if (verifyError) {
    return NextResponse.json({ error: verifyError.message }, { status: 500 });
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
