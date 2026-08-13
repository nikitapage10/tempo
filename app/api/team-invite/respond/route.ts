import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  TEAM_INVITE_UNAVAILABLE_MESSAGE,
  activatePendingTeamMember,
  declinePendingTeamMember,
  noStoreHeaders,
} from "@/lib/team-invite-server";

export const dynamic = "force-dynamic";

/**
 * POST /api/team-invite/respond — accept or decline a pending membership
 * that already named this signed-in user (handle / existing-email invites).
 */
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in first, then approve this invite." },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const body = await req.json().catch(() => null);
  const memberId = typeof body?.memberId === "string" ? body.memberId : "";
  const accept = body?.accept === true;
  if (!memberId) {
    return NextResponse.json(
      { error: "That invite isn’t available." },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("artist_members")
    .select("id, user_id, status, expires_at")
    .eq("id", memberId)
    .maybeSingle();
  if (!member || member.status !== "pending" || member.user_id !== user.id) {
    return NextResponse.json(
      { error: TEAM_INVITE_UNAVAILABLE_MESSAGE },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  if (member.expires_at && new Date(member.expires_at).getTime() <= Date.now()) {
    return NextResponse.json(
      { error: TEAM_INVITE_UNAVAILABLE_MESSAGE },
      { status: 410, headers: noStoreHeaders() }
    );
  }

  const { data: memberProfile } = await admin
    .from("artist_member_profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();
  const actorName =
    (typeof memberProfile?.display_name === "string" && memberProfile.display_name.trim()) ||
    user.email ||
    "Someone";

  if (!accept) {
    const declined = await declinePendingTeamMember({
      memberId,
      userId: user.id,
      actorName,
    });
    if (!declined) {
      return NextResponse.json(
        { error: TEAM_INVITE_UNAVAILABLE_MESSAGE },
        { status: 409, headers: noStoreHeaders() }
      );
    }
    return NextResponse.json({ ok: true, accepted: false }, { headers: noStoreHeaders() });
  }

  const activated = await activatePendingTeamMember({
    memberId,
    userId: user.id,
    actorName,
  });
  if (!activated) {
    return NextResponse.json(
      { error: TEAM_INVITE_UNAVAILABLE_MESSAGE },
      { status: 409, headers: noStoreHeaders() }
    );
  }

  return NextResponse.json(
    { ok: true, accepted: true, artist_id: activated.artist_id },
    { headers: noStoreHeaders() }
  );
}
