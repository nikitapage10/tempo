import type { SupabaseClient } from "@supabase/supabase-js";

export type MemberInviteKind = "team" | "collaborator";

export type AdminMemberInvite = {
  id: string;
  kind: MemberInviteKind;
  email: string | null;
  status: string;
  role: string;
  invitedByName: string;
  invitedByUserId: string;
  context: string;
  createdAt: string;
  acceptedAt: string | null;
};

export type AdminArtistInviteRequest = {
  id: string;
  email: string;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  requestedByName: string;
  requestedByUserId: string;
  trackTitle: string | null;
  artistName: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

function missingTable(error: { message?: string } | null): boolean {
  return /schema cache|does not exist|artist_invite_requests/i.test(
    error?.message ?? ""
  );
}

async function namesForUsers(
  service: SupabaseClient,
  userIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return map;

  const [{ data: artists }, { data: profiles }, { data: members }] =
    await Promise.all([
      service
        .from("artists")
        .select("user_id, name, workspace_kind")
        .in("user_id", ids),
      service
        .from("artist_profiles")
        .select("owner_user_id, display_name")
        .in("owner_user_id", ids),
      service
        .from("artist_member_profiles")
        .select("user_id, display_name")
        .in("user_id", ids),
    ]);

  for (const row of artists ?? []) {
    if (row.workspace_kind === "personal") continue;
    if (typeof row.name === "string" && row.name.trim()) {
      map.set(row.user_id, row.name.trim());
    }
  }
  for (const row of profiles ?? []) {
    if (typeof row.display_name === "string" && row.display_name.trim()) {
      map.set(row.owner_user_id, row.display_name.trim());
    }
  }
  for (const row of members ?? []) {
    if (typeof row.display_name === "string" && row.display_name.trim()) {
      map.set(row.user_id, row.display_name.trim());
    }
  }
  return map;
}

function labelFor(names: Map<string, string>, userId: string): string {
  return names.get(userId) || "A TEMPO member";
}

export async function listMemberInvites(
  service: SupabaseClient
): Promise<AdminMemberInvite[]> {
  const [{ data: team }, { data: collabs }] = await Promise.all([
    service
      .from("artist_members")
      .select(
        "id, invited_email, role, status, invited_by, created_at, accepted_at, artist_id, artists(name)"
      )
      .order("created_at", { ascending: false })
      .limit(200),
    service
      .from("track_collaborators")
      .select(
        "id, invited_email, role, status, invited_by, created_at, accepted_at, track_id, tracks(title)"
      )
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const inviterIds = [
    ...(team ?? []).map((row) => row.invited_by as string),
    ...(collabs ?? []).map((row) => row.invited_by as string),
  ];
  const names = await namesForUsers(service, inviterIds);

  const rows: AdminMemberInvite[] = [];
  for (const row of team ?? []) {
    const artist = row.artists as { name?: string } | { name?: string }[] | null;
    const artistName = Array.isArray(artist) ? artist[0]?.name : artist?.name;
    rows.push({
      id: row.id,
      kind: "team",
      email: row.invited_email ?? null,
      status: row.status,
      role: row.role,
      invitedByName: labelFor(names, row.invited_by),
      invitedByUserId: row.invited_by,
      context: artistName?.trim() || "Team",
      createdAt: row.created_at,
      acceptedAt: row.accepted_at ?? null,
    });
  }
  for (const row of collabs ?? []) {
    const track = row.tracks as { title?: string } | { title?: string }[] | null;
    const title = Array.isArray(track) ? track[0]?.title : track?.title;
    rows.push({
      id: row.id,
      kind: "collaborator",
      email: row.invited_email ?? null,
      status: row.status,
      role: row.role,
      invitedByName: labelFor(names, row.invited_by),
      invitedByUserId: row.invited_by,
      context: title?.trim() || "A track",
      createdAt: row.created_at,
      acceptedAt: row.accepted_at ?? null,
    });
  }

  rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return rows.slice(0, 200);
}

export async function listArtistInviteRequests(
  service: SupabaseClient
): Promise<AdminArtistInviteRequest[]> {
  const { data, error } = await service
    .from("artist_invite_requests")
    .select(
      "id, email, note, status, requested_by, created_at, reviewed_at, track_id, artist_id, tracks(title), artists(name)"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    if (missingTable(error)) return [];
    throw error;
  }

  const names = await namesForUsers(
    service,
    (data ?? []).map((row) => row.requested_by as string)
  );

  return (data ?? []).map((row) => {
    const track = row.tracks as { title?: string } | { title?: string }[] | null;
    const artist = row.artists as { name?: string } | { name?: string }[] | null;
    const trackTitle = Array.isArray(track) ? track[0]?.title : track?.title;
    const artistName = Array.isArray(artist) ? artist[0]?.name : artist?.name;
    const status = row.status as AdminArtistInviteRequest["status"];
    return {
      id: row.id,
      email: row.email,
      note: row.note ?? null,
      status:
        status === "approved" || status === "rejected" ? status : "pending",
      requestedByName: labelFor(names, row.requested_by),
      requestedByUserId: row.requested_by,
      trackTitle: trackTitle?.trim() || null,
      artistName: artistName?.trim() || null,
      createdAt: row.created_at,
      reviewedAt: row.reviewed_at ?? null,
    };
  });
}

export async function notifyAdminsOfArtistInviteRequest(input: {
  service: SupabaseClient;
  requestId: string;
  email: string;
  requestedByName: string;
}) {
  const { data: admins } = await input.service
    .from("platform_admins")
    .select("user_id");
  if (!admins?.length) return;
  await input.service.from("notifications").insert(
    admins.map((admin) => ({
      user_id: admin.user_id,
      type: "artist_invite_request",
      title: "Artist invite needs approval",
      body: `${input.requestedByName} wants to invite ${input.email} as a full TEMPO artist.`,
      entity_type: "artist_invite_request",
      entity_id: input.requestId,
      link_url: "/admin/invites",
      group_key: `artist-invite-request:${input.requestId}`,
    }))
  );
}

export async function notifyRequesterOfArtistInviteDecision(input: {
  service: SupabaseClient;
  userId: string;
  email: string;
  approved: boolean;
}) {
  await input.service.from("notifications").insert({
    user_id: input.userId,
    type: "artist_invite_reviewed",
    title: input.approved
      ? "Artist invite approved"
      : "Artist invite not sent",
    body: input.approved
      ? `TEMPO sent ${input.email} an artist invite.`
      : `The artist invite for ${input.email} was not approved.`,
    entity_type: "artist_invite_request",
    link_url: "/",
  });
}
