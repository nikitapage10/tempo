import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { sendTeamInviteEmail } from "@/lib/team/invite-email";
import { siteOrigin } from "@/lib/tokens";
import type { MemberRole } from "@/lib/team/roles";
import { normalizeAreas } from "@/lib/team/areas";

export const dynamic = "force-dynamic";

function sha256HexServer(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * POST /api/team-invite/send — sends the actual invite email, called right
 * after lib/api/artist-members.ts inviteMember() creates the row client-side.
 * The client already has the raw token (it generated it) but never the hash
 * alone is stored, so this route re-hashes what the client sends and checks
 * it against the stored invite_token_hash before sending anything — a
 * caller can't get an email sent for a token they don't actually hold.
 *
 * Resend requires server-only credentials, which is the only reason this is
 * a separate call from the (RLS-authorized) client-side insert rather than
 * one round trip.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const memberId = body?.memberId;
  const rawToken = body?.rawToken;
  if (typeof memberId !== "string" || typeof rawToken !== "string" || !rawToken) {
    return NextResponse.json({ error: "memberId and rawToken are required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: member, error } = await admin
    .from("artist_members")
    .select("id, artist_id, invited_email, role, areas, relationship_label, invite_message, status, invite_token_hash, expires_at")
    .eq("id", memberId)
    .maybeSingle();
  if (error || !member) {
    return NextResponse.json({ error: "That invite isn’t available." }, { status: 404 });
  }
  if (member.status !== "pending" || !member.invited_email) {
    return NextResponse.json({ error: "That invite has already been used." }, { status: 409 });
  }
  if (sha256HexServer(rawToken) !== member.invite_token_hash) {
    return NextResponse.json({ error: "That invite token doesn’t match." }, { status: 403 });
  }

  const { data: artist } = await admin
    .from("artists")
    .select("id, name, user_id")
    .eq("id", member.artist_id)
    .maybeSingle();
  if (!artist || artist.user_id !== user.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (!process.env.RESEND_API_KEY || !process.env.INVITE_FROM_EMAIL) {
    // Not a hard failure — the caller still has the copyable link as a
    // fallback. This just means nobody has configured outbound email yet.
    return NextResponse.json({ sent: false, reason: "not_configured" });
  }

  try {
    await sendTeamInviteEmail({
      email: member.invited_email,
      artistName: artist.name,
      role: member.role as MemberRole,
      invitedByEmail: user.email ?? "Your TEMPO team",
      inviteUrl: `${siteOrigin()}/team-invite/${rawToken}`,
      expiresAt: member.expires_at,
      idempotencyKey: `team-invite/${member.id}/send/1`,
      areas: normalizeAreas(member.areas),
      relationshipLabel: member.relationship_label,
      inviteMessage: member.invite_message,
    });
    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error("[team-invite][send]", err);
    return NextResponse.json(
      { sent: false, reason: err instanceof Error ? err.message : "send_failed" },
      { status: 502 }
    );
  }
}
