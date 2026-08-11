import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Identifies the single coordinated local preview without exposing it remotely. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (process.env.NODE_ENV !== "development" || !LOOPBACK.has(url.hostname)) {
    return new NextResponse(null, { status: 404 });
  }

  let backendReachable: boolean | undefined;
  if (url.searchParams.get("network") === "1") {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      backendReachable = false;
    } else {
      try {
        const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
          cache: "no-store",
          headers: { apikey: anonKey },
          signal: AbortSignal.timeout(5000),
        });
        backendReachable = response.ok;
      } catch {
        backendReachable = false;
      }
    }
  }

  return NextResponse.json({
    app: "tempo",
    port: 3000,
    pid: process.pid,
    root: process.env.TEMPO_DEV_ROOT ?? process.cwd(),
    branch: process.env.TEMPO_DEV_BRANCH ?? "unknown",
    localSignIn: Boolean(
      process.env.DEV_PREVIEW_EMAIL || process.env.DEV_TEST_EMAIL
    ),
    ...(backendReachable === undefined ? {} : { backendReachable }),
  });
}
