import { NextResponse, type NextRequest } from "next/server";
import { authAccountExistsForEmail } from "@/lib/auth/account-exists";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { connectTeamNetworkFollows } from "@/lib/social/connect-team-follows";
import {
  TEAM_INVITE_UNAVAILABLE_MESSAGE,
  noStoreHeaders,
  resolveTeamInvite,
} from "@/lib/team-invite-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/team-invite/[token] — public preview: artist name + role + whether
 * the invited email already has a TEMPO account (so the landing CTA can say
 * Sign in vs Create an account). Never leaks the inviter's identity, and
 * account_exists is only for this invite's bound email.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? "Server is missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local, then restart npm run dev."
            : TEAM_INVITE_UNAVAILABLE_MESSAGE,
      },
      { status: 503, headers: noStoreHeaders() }
    );
  }

  const ctx = await resolveTeamInvite(params.token);
  if (!ctx) {
    return NextResponse.json(
      { error: TEAM_INVITE_UNAVAILABLE_MESSAGE },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  const accountExists = await authAccountExistsForEmail(ctx.member.invited_email);
  return NextResponse.json(
    {
      artist: { name: ctx.artist.name },
      role: ctx.member.role,
      invited_email: ctx.member.invited_email,
      account_exists: accountExists,
    },
    { headers: noStoreHeaders() }
  );
}

/**
 * POST /api/team-invite/[token] — accept. Requires an authenticated session
 * whose email matches invited_email exactly. Runs the update with the
 * service-role client because RLS on artist_members only lets the artist
 * owner or the already-linked user write — an about-to-be-linked invitee
 * can't do this from the browser (same reasoning as the track invite route).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const ctx = await resolveTeamInvite(params.token);
  if (!ctx) {
    return NextResponse.json(
      { error: TEAM_INVITE_UNAVAILABLE_MESSAGE },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json(
      { error: "Sign in first, then open this invite link again." },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  if (user.email.trim().toLowerCase() !== ctx.member.invited_email.trim().toLowerCase()) {
    return NextResponse.json(
      {
        error:
          "This invite was sent to a different email address. Sign in with the invited email to accept it.",
      },
      { status: 403, headers: noStoreHeaders() }
    );
  }

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("artist_members")
    .update({
      user_id: user.id,
      status: "active",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", ctx.member.id)
    .eq("status", "pending")
    .select("id, artist_id, role, invited_by")
    .maybeSingle();

  if (error || !updated) {
    return NextResponse.json(
      { error: TEAM_INVITE_UNAVAILABLE_MESSAGE },
      { status: 409, headers: noStoreHeaders() }
    );
  }

  const { data: memberProfile } = await admin
    .from("artist_member_profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();
  const actorName =
    (typeof memberProfile?.display_name === "string" && memberProfile.display_name.trim()) ||
    user.email;

  // Best-effort notification — never block acceptance on this.
  void admin
    .from("notifications")
    .insert({
      user_id: updated.invited_by,
      type: "team_invite_accepted",
      title: `${actorName} accepted your team invite`,
      body: `They can now access "${ctx.artist.name}" as ${updated.role}.`,
    })
    .then(
      () => {},
      () => {}
    );

  try {
    await connectTeamNetworkFollows(admin, user.id);
  } catch (error) {
    console.error("[team-invite] team follow connect pending", error);
  }

  return NextResponse.json({ artist_id: updated.artist_id }, { headers: noStoreHeaders() });
}
