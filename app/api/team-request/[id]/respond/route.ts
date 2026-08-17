import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createMemberInvite } from "@/lib/team/create-member-invite";
import { noStoreHeaders } from "@/lib/team-invite-server";
import { AREA_KEYS, type AreaGrants } from "@/lib/team/areas";
import { MEMBER_ROLES, ROLE_LABELS, type MemberRole } from "@/lib/team/roles";

export const dynamic = "force-dynamic";

type TeamRequestRow = {
  id: string;
  artist_id: string;
  requester_user_id: string;
  requester_profile_id: string;
  requested_role: MemberRole;
  note: string | null;
  status: "pending" | "invited" | "declined" | "cancelled";
};

function isMemberRole(value: unknown): value is MemberRole {
  return typeof value === "string" && (MEMBER_ROLES as readonly string[]).includes(value);
}

function statusOf(error: unknown): number {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number") return status;
  }
  return 500;
}

function unsafeAreas(areas: AreaGrants): boolean {
  return areas.stats === "write" || areas.social === "write" || areas.team === "write";
}

function parseAreas(value: unknown): AreaGrants {
  if (!value || typeof value !== "object") return {};
  const input = value as Record<string, unknown>;
  const areas: AreaGrants = {};
  for (const key of AREA_KEYS) {
    const level = input[key];
    if (level === "none" || level === "read" || level === "write") areas[key] = level;
  }
  return areas;
}

/**
 * POST /api/team-request/[id]/respond
 *
 * Requesters may cancel. Only the artist owner may decline or convert a
 * request into a normal, still-pending invitation with an exact access map.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401, headers: noStoreHeaders() });
  }

  const body = await req.json().catch(() => null);
  const action = body?.action;
  if (!(["cancel", "decline", "invite"] as const).includes(action)) {
    return NextResponse.json({ error: "Pick a valid response." }, { status: 400, headers: noStoreHeaders() });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("artist_team_requests")
    .select("id, artist_id, requester_user_id, requester_profile_id, requested_role, note, status")
    .eq("id", params.id)
    .maybeSingle();
  const teamRequest = data as TeamRequestRow | null;
  if (!teamRequest) {
    return NextResponse.json({ error: "That team request is no longer available." }, { status: 404, headers: noStoreHeaders() });
  }
  if (teamRequest.status !== "pending") {
    return NextResponse.json({ error: "That team request has already been answered." }, { status: 409, headers: noStoreHeaders() });
  }

  const { data: artist } = await admin
    .from("artists")
    .select("id, name, user_id")
    .eq("id", teamRequest.artist_id)
    .maybeSingle();
  if (!artist) {
    return NextResponse.json({ error: "That artist is no longer available." }, { status: 404, headers: noStoreHeaders() });
  }

  if (action === "cancel") {
    if (teamRequest.requester_user_id !== user.id) {
      return NextResponse.json({ error: "Only the requester can cancel this request." }, { status: 403, headers: noStoreHeaders() });
    }
    const { error } = await admin
      .from("artist_team_requests")
      .update({ status: "cancelled", responded_by_user_id: user.id, responded_at: new Date().toISOString() })
      .eq("id", teamRequest.id)
      .eq("status", "pending");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: noStoreHeaders() });
    }
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  }

  if (artist.user_id !== user.id) {
    return NextResponse.json({ error: "Only the artist can answer this request." }, { status: 403, headers: noStoreHeaders() });
  }

  const { data: requesterProfile } = await admin
    .from("artist_profiles")
    .select("id, display_name")
    .eq("id", teamRequest.requester_profile_id)
    .eq("owner_user_id", teamRequest.requester_user_id)
    .eq("profile_kind", "pro")
    .maybeSingle();
  if (!requesterProfile) {
    return NextResponse.json({ error: "That Pro profile is no longer available." }, { status: 404, headers: noStoreHeaders() });
  }

  if (action === "decline") {
    const { error } = await admin
      .from("artist_team_requests")
      .update({ status: "declined", responded_by_user_id: user.id, responded_at: new Date().toISOString() })
      .eq("id", teamRequest.id)
      .eq("status", "pending");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: noStoreHeaders() });
    }
    await admin.from("notifications").insert({
      user_id: teamRequest.requester_user_id,
      type: "team_join_request_declined",
      title: `${artist.name} passed on your team request`,
      body: "No workspace access was shared.",
      entity_type: "artist_team_request",
      entity_id: teamRequest.id,
      link_url: "/team?tab=roster",
      group_key: `team-request-response:${teamRequest.id}`,
    }).then(() => {}, () => {});
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  }

  const role: MemberRole = isMemberRole(body?.role)
    ? (body.role as MemberRole)
    : teamRequest.requested_role;
  const areas = parseAreas(body?.areas);
  const inviteMessage = typeof body?.inviteMessage === "string" ? body.inviteMessage.trim() : "";
  if (inviteMessage.length > 1000) {
    return NextResponse.json({ error: "Keep the invitation note under 1,000 characters." }, { status: 400, headers: noStoreHeaders() });
  }
  if (unsafeAreas(areas)) {
    return NextResponse.json({ error: "Stats, Social, and Team administration cannot be writable." }, { status: 400, headers: noStoreHeaders() });
  }

  try {
    // If an invitation was created independently, or a prior response made
    // the invite but lost its final request update, close the request around
    // that existing relationship instead of creating a duplicate.
    const { data: existingMembership } = await admin
      .from("artist_members")
      .select("id, status")
      .eq("artist_id", teamRequest.artist_id)
      .eq("user_id", teamRequest.requester_user_id)
      .in("status", ["pending", "active", "suspended"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingMembership) {
      const { error: closeError } = await admin
        .from("artist_team_requests")
        .update({
          status: "invited",
          membership_id: existingMembership.id,
          responded_by_user_id: user.id,
          responded_at: new Date().toISOString(),
        })
        .eq("id", teamRequest.id)
        .eq("status", "pending");
      if (closeError) throw closeError;
      return NextResponse.json(
        { ok: true, memberId: existingMembership.id, existing: true },
        { headers: noStoreHeaders() }
      );
    }

    const invite = await createMemberInvite(admin, {
      artistId: teamRequest.artist_id,
      role,
      invitedByUserId: user.id,
      invitedByEmail: user.email ?? null,
      profileId: teamRequest.requester_profile_id,
      areaOverrides: areas,
      relationshipLabel: ROLE_LABELS[role],
      inviteMessage: inviteMessage || null,
    });
    const { error } = await admin
      .from("artist_team_requests")
      .update({
        status: "invited",
        membership_id: invite.memberId,
        responded_by_user_id: user.id,
        responded_at: new Date().toISOString(),
      })
      .eq("id", teamRequest.id)
      .eq("status", "pending");
    if (error) throw error;
    return NextResponse.json({ ok: true, memberId: invite.memberId }, { headers: noStoreHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn’t send that invitation.";
    return NextResponse.json({ error: message }, { status: statusOf(error), headers: noStoreHeaders() });
  }
}
