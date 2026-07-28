import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function noStoreHeaders(): HeadersInit {
  return { "Cache-Control": "no-store" };
}

/**
 * POST /api/auth/verify-invite — checked before account creation on
 * /register. The code lives only in the server-only INVITE_CODE env var so
 * it never reaches the client bundle; compare case-insensitively since it's
 * typed by hand. If INVITE_CODE isn't set, every code fails closed rather
 * than opening signups to anyone.
 *
 * Body: { code: string }
 */
export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null);
  const code = typeof payload?.code === "string" ? payload.code.trim() : "";

  if (!code) {
    return NextResponse.json(
      { ok: false, error: "Enter an invite code." },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const expected = process.env.INVITE_CODE?.trim();
  if (!expected || code.toLowerCase() !== expected.toLowerCase()) {
    return NextResponse.json(
      { ok: false, error: "That invite code isn’t valid." },
      { status: 403, headers: noStoreHeaders() }
    );
  }

  return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
}
