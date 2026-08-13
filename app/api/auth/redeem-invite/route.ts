import { type NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { INVITE_COLUMNS } from "@/lib/admin/select";
import { ensureOriginArtistForInvite } from "@/lib/auth/ensure-origin-artist";

export const dynamic = "force-dynamic";
const headers: HeadersInit = { "Cache-Control": "no-store" };

type InviteRole = "artist" | "team_member" | "administrator";

function asInviteRole(value: unknown): InviteRole {
  if (value === "team_member" || value === "administrator") return value;
  return "artist";
}

export async function POST(req: NextRequest) {
  const session = createServerClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers });

  const body = await req.json().catch(() => null);
  let inviteId = typeof body?.inviteId === "string" ? body.inviteId : "";
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  const service = createAdminClient();

  try {
    let memberRole: InviteRole = "artist";

    if (!inviteId && code) {
      const { data: invite } = await service
        .from("invites")
        .select(INVITE_COLUMNS)
        .eq("code", code)
        .maybeSingle();
      if (!invite || invite.revoked_at) {
        return NextResponse.json(
          { error: "That invite is no longer available." },
          { status: 409, headers }
        );
      }
      if (invite.expires_at && new Date(invite.expires_at) <= new Date()) {
        return NextResponse.json(
          { error: "That invite is no longer available." },
          { status: 409, headers }
        );
      }
      if (
        invite.email &&
        user.email &&
        invite.email.toLowerCase() !== user.email.toLowerCase()
      ) {
        return NextResponse.json(
          { error: "That invite was sent to a different email." },
          { status: 403, headers }
        );
      }
      inviteId = invite.id;
      memberRole = asInviteRole(invite.member_role);
    } else if (inviteId) {
      const { data: invite } = await service
        .from("invites")
        .select("email, member_role")
        .eq("id", inviteId)
        .maybeSingle();
      if (
        invite?.email &&
        user.email &&
        invite.email.toLowerCase() !== user.email.toLowerCase()
      ) {
        return NextResponse.json(
          { error: "That invite was sent to a different email." },
          { status: 403, headers }
        );
      }
      memberRole = asInviteRole(invite?.member_role);
    }

    if (!inviteId) return NextResponse.json({ ok: true, startOrigin: false }, { headers });

    const { data: existing } = await service
      .from("invite_redemptions")
      .select("user_id")
      .eq("invite_id", inviteId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existing) {
      const { data, error } = await service.rpc("redeem_platform_invite", {
        p_invite_id: inviteId,
        p_user_id: user.id,
      });
      if (error || data !== true) {
        return NextResponse.json(
          { error: "That invite is no longer available." },
          { status: 409, headers }
        );
      }
    }

    if (memberRole === "team_member") {
      return NextResponse.json({ ok: true, startOrigin: false }, { headers });
    }

    const origin = await ensureOriginArtistForInvite(service, user.id);
    return NextResponse.json({ ok: true, ...origin }, { headers });
  } catch {
    return NextResponse.json({ error: "Couldn’t redeem the invite." }, { status: 500, headers });
  }
}
