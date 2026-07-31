import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { INVITE_COLUMNS } from "@/lib/admin/select";

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
  const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";

  if (!code) {
    return NextResponse.json(
      { ok: false, error: "Enter an invite code." },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  try {
    const service = createAdminClient();
    const { data: invite } = await service.from("invites").select(INVITE_COLUMNS).eq("code", code.toUpperCase()).is("revoked_at", null).maybeSingle();
    if (invite && (!invite.expires_at || new Date(invite.expires_at) > new Date()) && invite.used_count < invite.max_uses && (!invite.email || invite.email.toLowerCase() === email)) {
      return NextResponse.json({ ok: true, inviteId: invite.id }, { headers: noStoreHeaders() });
    }
  } catch {
    // Migration may not be installed yet; preserve the legacy gate below.
  }

  const expected = process.env.INVITE_CODE?.trim();
  if (!expected || code.toLowerCase() !== expected.toLowerCase()) {
    return NextResponse.json(
      { ok: false, error: "That invite code isn’t valid." },
      { status: 403, headers: noStoreHeaders() }
    );
  }

  return NextResponse.json({ ok: true, inviteId: null }, { headers: noStoreHeaders() });
}
