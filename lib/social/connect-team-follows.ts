/**
 * Mutual follows between a team member and the artists they work with,
 * once both sides are on the member network.
 */

import type { createAdminClient } from "@/lib/supabase/admin";

export type NetworkProfile = {
  id: string;
  artistId: string;
  ownerUserId: string;
};

export type TeamRosterLink = {
  artistId: string;
  memberUserId: string;
};

type Service = ReturnType<typeof createAdminClient>;

function pickProfileForUser(
  profiles: NetworkProfile[],
  userId: string,
  personalArtistIds: Set<string>,
  excludeArtistId?: string
): NetworkProfile | undefined {
  const owned = profiles.filter(
    (p) => p.ownerUserId === userId && p.artistId !== excludeArtistId
  );
  return owned.find((p) => personalArtistIds.has(p.artistId)) ?? owned[0];
}

/** Undirected pairs, then both follow directions. Self-follows are skipped. */
export function teamFollowEdges(args: {
  links: TeamRosterLink[];
  profiles: NetworkProfile[];
  personalArtistIds: Set<string>;
}): { follower_profile_id: string; followee_profile_id: string }[] {
  const seen = new Set<string>();
  const edges: { follower_profile_id: string; followee_profile_id: string }[] = [];

  for (const link of args.links) {
    const artistProfile = args.profiles.find((p) => p.artistId === link.artistId);
    const memberProfile = pickProfileForUser(
      args.profiles,
      link.memberUserId,
      args.personalArtistIds,
      link.artistId
    );
    if (!artistProfile || !memberProfile) continue;
    if (artistProfile.id === memberProfile.id) continue;
    if (artistProfile.ownerUserId === memberProfile.ownerUserId) continue;

    const key =
      artistProfile.id < memberProfile.id
        ? `${artistProfile.id}:${memberProfile.id}`
        : `${memberProfile.id}:${artistProfile.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({
      follower_profile_id: memberProfile.id,
      followee_profile_id: artistProfile.id,
    });
    edges.push({
      follower_profile_id: artistProfile.id,
      followee_profile_id: memberProfile.id,
    });
  }

  return edges;
}

/**
 * Best-effort: wire every live team roster link for this user to mutual
 * follows when both identities are on the network. Safe to call again.
 */
export async function connectTeamNetworkFollows(
  service: Service,
  userId: string
): Promise<void> {
  const { data: owned, error: ownedError } = await service
    .from("artists")
    .select("id, user_id, workspace_kind, demo_kind")
    .eq("user_id", userId)
    .is("demo_kind", null);
  if (ownedError) throw ownedError;

  const musicIds = (owned ?? [])
    .filter((row) => row.workspace_kind !== "personal")
    .map((row) => row.id);

  const { data: asMember, error: memberError } = await service
    .from("artist_members")
    .select("artist_id, user_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .not("user_id", "is", null);
  if (memberError) throw memberError;

  let roster: { artist_id: string; user_id: string }[] = [];
  if (musicIds.length > 0) {
    const { data, error } = await service
      .from("artist_members")
      .select("artist_id, user_id")
      .in("artist_id", musicIds)
      .eq("status", "active")
      .not("user_id", "is", null);
    if (error) throw error;
    roster = (data ?? []).filter((row): row is { artist_id: string; user_id: string } =>
      Boolean(row.user_id)
    );
  }

  const teammateArtistIds = Array.from(
    new Set((asMember ?? []).map((row) => row.artist_id))
  );
  const memberUserIds = Array.from(new Set(roster.map((row) => row.user_id)));

  let liveTeammateArtistIds = teammateArtistIds;
  if (teammateArtistIds.length > 0) {
    const { data: teammateArtists, error } = await service
      .from("artists")
      .select("id, demo_kind")
      .in("id", teammateArtistIds);
    if (error) throw error;
    liveTeammateArtistIds = (teammateArtists ?? [])
      .filter((row) => !row.demo_kind)
      .map((row) => row.id);
  }

  const extraUserIds = memberUserIds.filter((id) => id !== userId);
  let extraOwned: { id: string; user_id: string; workspace_kind: string | null }[] =
    [];
  if (extraUserIds.length > 0) {
    const { data, error } = await service
      .from("artists")
      .select("id, user_id, workspace_kind, demo_kind")
      .in("user_id", extraUserIds)
      .is("demo_kind", null);
    if (error) throw error;
    extraOwned = data ?? [];
  }

  const personalArtistIds = new Set<string>([
    ...(owned ?? [])
      .filter((row) => row.workspace_kind === "personal")
      .map((row) => row.id),
    ...extraOwned
      .filter((row) => row.workspace_kind === "personal")
      .map((row) => row.id),
  ]);

  const artistIdsForProfiles = Array.from(
    new Set([
      ...(owned ?? []).map((row) => row.id),
      ...liveTeammateArtistIds,
      ...extraOwned.map((row) => row.id),
    ])
  );
  if (artistIdsForProfiles.length === 0) return;

  const { data: profileRows, error: profileError } = await service
    .from("artist_profiles")
    .select("id, artist_id, owner_user_id, visibility")
    .in("artist_id", artistIdsForProfiles)
    .in("visibility", ["members", "public"]);
  if (profileError) throw profileError;

  const profiles: NetworkProfile[] = (profileRows ?? []).map((row) => ({
    id: row.id,
    artistId: row.artist_id,
    ownerUserId: row.owner_user_id,
  }));

  const links: TeamRosterLink[] = [
    ...liveTeammateArtistIds.map((artistId) => ({
      artistId,
      memberUserId: userId,
    })),
    ...roster.map((row) => ({
      artistId: row.artist_id,
      memberUserId: row.user_id,
    })),
  ];

  const edges = teamFollowEdges({ links, profiles, personalArtistIds });
  if (edges.length === 0) return;

  const { error: upsertError } = await service.from("profile_follows").upsert(edges, {
    onConflict: "follower_profile_id,followee_profile_id",
    ignoreDuplicates: true,
  });
  if (upsertError) throw upsertError;
}
