import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { INVITE_COLUMNS } from "@/lib/admin/select";
import { authAccountExistsForEmail } from "@/lib/auth/account-exists";
import { resolveInvite } from "@/lib/invite-server";
import { resolveTeamInvite } from "@/lib/team-invite-server";

export const dynamic = "force-dynamic";

function noStoreHeaders(): HeadersInit {
  return { "Cache-Control": "no-store" };
}

function emailsMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * POST /api/auth/verify-invite — checked before account creation on
 * /register. Three gates, all fail closed:
 *
 * 1. A pending team-invite token bound to this email (managers etc.)
 * 2. A pending track-invite token bound to this email (collaborators)
 * 3. A platform invite code (legacy INVITE_CODE env, or a row in `invites`)
 *
 * Body: { email?: string, code?: string, teamInviteToken?: string, trackInviteToken?: string }
 *
 * Code-only lookups return the bound email and whether that address already
 * has a TEMPO account, so /register can send existing team members to sign in
 * instead of asking them to create a second login.
 */
export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null);
  const code = typeof payload?.code === "string" ? payload.code.trim() : "";
  const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
  const teamInviteToken =
    typeof payload?.teamInviteToken === "string" ? payload.teamInviteToken.trim() : "";
  const trackInviteToken =
    typeof payload?.trackInviteToken === "string" ? payload.trackInviteToken.trim() : "";

  if (teamInviteToken && trackInviteToken) {
    return NextResponse.json(
      { ok: false, error: "That invite isn’t valid." },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  if (teamInviteToken) {
    const ctx = await resolveTeamInvite(teamInviteToken);
    if (!ctx || !email || !ctx.member.invited_email || !emailsMatch(email, ctx.member.invited_email)) {
      return NextResponse.json(
        { ok: false, error: "That invite isn’t valid for this email." },
        { status: 403, headers: noStoreHeaders() }
      );
    }
    return NextResponse.json({ ok: true, inviteId: null }, { headers: noStoreHeaders() });
  }

  if (trackInviteToken) {
    const ctx = await resolveInvite(trackInviteToken);
    if (!ctx || !email || !emailsMatch(email, ctx.collaborator.invited_email)) {
      return NextResponse.json(
        { ok: false, error: "That invite isn’t valid for this email." },
        { status: 403, headers: noStoreHeaders() }
      );
    }
    return NextResponse.json({ ok: true, inviteId: null }, { headers: noStoreHeaders() });
  }

  if (!code) {
    return NextResponse.json(
      { ok: false, error: "Enter an invite code." },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  try {
    const service = createAdminClient();
    const { data: invite } = await service.from("invites").select(INVITE_COLUMNS).eq("code", code.toUpperCase()).is("revoked_at", null).maybeSingle();
    const usable =
      invite &&
      (!invite.expires_at || new Date(invite.expires_at) > new Date()) &&
      invite.used_count < invite.max_uses;
    if (usable && (!email || !invite.email || invite.email.toLowerCase() === email)) {
      const boundEmail =
        typeof invite.email === "string" ? invite.email.toLowerCase() : null;
      const accountExists = boundEmail
        ? await authAccountExistsForEmail(boundEmail)
        : null;
      return NextResponse.json(
        {
          ok: true,
          inviteId: invite.id,
          email: boundEmail,
          accountExists,
          memberRole: invite.member_role ?? "artist",
        },
        { headers: noStoreHeaders() }
      );
    }
    if (usable && invite.email && email && invite.email.toLowerCase() !== email) {
      return NextResponse.json(
        { ok: false, error: "That invite isn’t valid for this email." },
        { status: 403, headers: noStoreHeaders() }
      );
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
