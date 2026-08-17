import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { noStoreHeaders } from "@/lib/team-invite-server";
import { MEMBER_ROLES, ROLE_LABELS, type MemberRole } from "@/lib/team/roles";

export const dynamic = "force-dynamic";

const PROFILE_COLUMNS =
  "id, artist_id, profile_kind, handle, display_name, emblem_url, palette_id, ice_color, amber_color, tagline";

type RequestRow = {
  id: string;
  artist_id: string;
  requester_user_id: string;
  requester_profile_id: string;
  requested_role: MemberRole;
  note: string | null;
  status: "pending" | "invited" | "declined" | "cancelled";
  membership_id: string | null;
  created_at: string;
  responded_at: string | null;
};

type ProfileRow = {
  id: string;
  artist_id: string;
  profile_kind: "artist" | "pro";
  handle: string | null;
  display_name: string;
  emblem_url: string | null;
  palette_id: string | null;
  ice_color: string | null;
  amber_color: string | null;
  tagline: string | null;
};

function missingSchema(message: string): boolean {
  return /artist_team_requests|schema cache|does not exist/i.test(message);
}

function isMemberRole(value: unknown): value is MemberRole {
  return typeof value === "string" && (MEMBER_ROLES as readonly string[]).includes(value);
}

function serialize(
  row: RequestRow,
  artistProfiles: Map<string, ProfileRow>,
  requesterProfiles: Map<string, ProfileRow>
) {
  return {
    id: row.id,
    artistId: row.artist_id,
    requestedRole: row.requested_role,
    note: row.note,
    status: row.status,
    membershipId: row.membership_id,
    createdAt: row.created_at,
    respondedAt: row.responded_at,
    artist: artistProfiles.get(row.artist_id) ?? null,
    requester: requesterProfiles.get(row.requester_profile_id) ?? null,
  };
}

async function profilesForRequests(admin: ReturnType<typeof createAdminClient>, rows: RequestRow[]) {
  const artistIds = Array.from(new Set(rows.map((row) => row.artist_id)));
  const requesterIds = Array.from(new Set(rows.map((row) => row.requester_profile_id)));
  const [{ data: artists }, { data: requesters }] = await Promise.all([
    artistIds.length
      ? admin.from("artist_profiles").select(PROFILE_COLUMNS).in("artist_id", artistIds).eq("profile_kind", "artist")
      : Promise.resolve({ data: [] }),
    requesterIds.length
      ? admin.from("artist_profiles").select(PROFILE_COLUMNS).in("id", requesterIds).eq("profile_kind", "pro")
      : Promise.resolve({ data: [] }),
  ]);
  return {
    artistProfiles: new Map(
      ((artists ?? []) as ProfileRow[]).map((profile) => [profile.artist_id, profile])
    ),
    requesterProfiles: new Map(
      ((requesters ?? []) as ProfileRow[]).map((profile) => [profile.id, profile])
    ),
  };
}

/** GET /api/team-request — outgoing Pro requests, or an artist owner's inbox. */
export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401, headers: noStoreHeaders() });
  }

  const admin = createAdminClient();
  const artistId = req.nextUrl.searchParams.get("artistId")?.trim() || null;
  let query = admin.from("artist_team_requests").select("*").order("created_at", { ascending: false }).limit(30);

  if (artistId) {
    const { data: artist } = await admin.from("artists").select("user_id").eq("id", artistId).maybeSingle();
    if (!artist || artist.user_id !== user.id) {
      return NextResponse.json({ error: "Only the artist can review these requests." }, { status: 403, headers: noStoreHeaders() });
    }
    query = query.eq("artist_id", artistId).eq("status", "pending");
  } else {
    query = query.eq("requester_user_id", user.id);
  }

  const { data, error } = await query;
  if (error) {
    if (missingSchema(error.message)) {
      return NextResponse.json({ requests: [] }, { headers: noStoreHeaders() });
    }
    return NextResponse.json({ error: error.message }, { status: 500, headers: noStoreHeaders() });
  }

  const rows = (data ?? []) as RequestRow[];
  const profiles = await profilesForRequests(admin, rows);
  return NextResponse.json(
    { requests: rows.map((row) => serialize(row, profiles.artistProfiles, profiles.requesterProfiles)) },
    { headers: noStoreHeaders() }
  );
}

/** POST /api/team-request — a Pro asks a published artist to consider them. */
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401, headers: noStoreHeaders() });
  }

  const body = await req.json().catch(() => null);
  const artistId = typeof body?.artistId === "string" ? body.artistId.trim() : "";
  const role = body?.role;
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  if (!artistId || !isMemberRole(role)) {
    return NextResponse.json({ error: "Pick an artist and a role." }, { status: 400, headers: noStoreHeaders() });
  }
  if (note.length > 1000) {
    return NextResponse.json({ error: "Keep your note under 1,000 characters." }, { status: 400, headers: noStoreHeaders() });
  }

  const admin = createAdminClient();
  const [{ data: proProfile }, { data: artist }] = await Promise.all([
    admin
      .from("artist_profiles")
      .select(PROFILE_COLUMNS)
      .eq("owner_user_id", user.id)
      .eq("profile_kind", "pro")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("artists")
      .select("id, name, user_id, workspace_kind, demo_kind")
      .eq("id", artistId)
      .maybeSingle(),
  ]);

  if (!proProfile) {
    return NextResponse.json({ error: "Finish your Pro profile before requesting a team role." }, { status: 400, headers: noStoreHeaders() });
  }
  if (!artist || artist.workspace_kind !== "artist" || artist.demo_kind) {
    return NextResponse.json({ error: "That artist isn’t available for team requests." }, { status: 404, headers: noStoreHeaders() });
  }
  if (artist.user_id === user.id) {
    return NextResponse.json({ error: "You already own this artist workspace." }, { status: 400, headers: noStoreHeaders() });
  }

  const { data: publishedProfile } = await admin
    .from("artist_profiles")
    .select(PROFILE_COLUMNS)
    .eq("artist_id", artistId)
    .eq("profile_kind", "artist")
    .in("visibility", ["members", "public"])
    .maybeSingle();
  if (!publishedProfile) {
    return NextResponse.json({ error: "That artist isn’t accepting requests from the network." }, { status: 404, headers: noStoreHeaders() });
  }

  const { data: memberships } = await admin
    .from("artist_members")
    .select("status")
    .eq("artist_id", artistId)
    .eq("user_id", user.id)
    .in("status", ["pending", "active", "suspended"])
    .limit(1);
  if ((memberships ?? []).length > 0) {
    const status = memberships![0]!.status;
    const message = status === "active"
      ? "You’re already on this artist’s team."
      : status === "suspended"
        ? "This artist has suspended your existing team access."
        : "This artist has already sent you an invitation.";
    return NextResponse.json({ error: message }, { status: 409, headers: noStoreHeaders() });
  }

  const { data: saved, error } = await admin
    .from("artist_team_requests")
    .insert({
      artist_id: artistId,
      requester_user_id: user.id,
      requester_profile_id: proProfile.id,
      requested_role: role,
      note: note || null,
    })
    .select("*")
    .single();
  if (error || !saved) {
    const message = error?.message || "Couldn’t send that request.";
    if (missingSchema(message)) {
      return NextResponse.json(
        { error: "Team requests aren’t set up yet — run migration 106 in Supabase." },
        { status: 503, headers: noStoreHeaders() }
      );
    }
    if (/artist_team_requests_one_pending|duplicate/i.test(message)) {
      return NextResponse.json({ error: "You already have a request waiting on this artist." }, { status: 409, headers: noStoreHeaders() });
    }
    return NextResponse.json({ error: message }, { status: 500, headers: noStoreHeaders() });
  }

  await admin.from("notifications").insert({
    user_id: artist.user_id,
    type: "team_join_request",
    title: `${proProfile.display_name} requested to join your team`,
    body: `${ROLE_LABELS[role]}${note ? ` · ${note.slice(0, 180)}` : ""}`,
    entity_type: "artist_team_request",
    entity_id: saved.id,
    link_url: "/team?tab=people",
    group_key: `team-request:${saved.id}`,
  }).then(() => {}, () => {});

  const row = saved as RequestRow;
  const artistProfiles = new Map([[artistId, publishedProfile as ProfileRow]]);
  const requesterProfiles = new Map([[proProfile.id, proProfile as ProfileRow]]);
  return NextResponse.json(
    { request: serialize(row, artistProfiles, requesterProfiles) },
    { status: 201, headers: noStoreHeaders() }
  );
}
