import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  INVITE_UNAVAILABLE_MESSAGE,
  noStoreHeaders,
  resolveInvite,
} from "@/lib/invite-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/invite/[token] — public preview: track title + role only, so the
 * landing page can say "You've been invited to <track> as <role>" before
 * the visitor signs in. Never leaks the inviter's identity or other data.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const ctx = await resolveInvite(params.token);
  if (!ctx) {
    return NextResponse.json(
      { error: INVITE_UNAVAILABLE_MESSAGE },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  return NextResponse.json(
    {
      track: { title: ctx.track.title },
      role: ctx.collaborator.role,
      invited_email: ctx.collaborator.invited_email,
    },
    { headers: noStoreHeaders() }
  );
}

/**
 * POST /api/invite/[token] — accept. Requires an authenticated session whose
 * email matches invited_email exactly (SECURITY-AND-PERMISSIONS.md §T4).
 * Runs the actual row update with the service-role client because RLS on
 * track_collaborators only allows the owner or the already-linked user to
 * write — an about-to-be-linked invitee can't do this from the browser.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const ctx = await resolveInvite(params.token);
  if (!ctx) {
    return NextResponse.json(
      { error: INVITE_UNAVAILABLE_MESSAGE },
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

  if (user.email.trim().toLowerCase() !== ctx.collaborator.invited_email.trim().toLowerCase()) {
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
    .from("track_collaborators")
    .update({
      user_id: user.id,
      status: "active",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", ctx.collaborator.id)
    .eq("status", "pending")
    .select("id, track_id, role, invited_by")
    .maybeSingle();

  if (error || !updated) {
    return NextResponse.json(
      { error: INVITE_UNAVAILABLE_MESSAGE },
      { status: 409, headers: noStoreHeaders() }
    );
  }

  // Best-effort notification + activity log — never block acceptance on these.
  void admin
    .from("notifications")
    .insert({
      user_id: updated.invited_by,
      track_id: updated.track_id,
      type: "invite_accepted",
      title: `${user.email} accepted your invite`,
      body: `They can now access "${ctx.track.title}" as ${updated.role}.`,
    })
    .then(() => {}, () => {});

  void admin
    .from("activity_events")
    .insert({
      track_id: updated.track_id,
      actor_user_id: user.id,
      actor_label: user.email,
      event_type: "collaborator_accepted",
      entity_type: "collaborator",
      entity_id: updated.id,
      summary: `${user.email} accepted the invite (${updated.role})`,
    })
    .then(() => {}, () => {});

  return NextResponse.json(
    { track_id: updated.track_id },
    { headers: noStoreHeaders() }
  );
}
