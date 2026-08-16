/**
 * Server-only team invite validation — mirrors lib/invite-server.ts exactly,
 * against artist_members instead of track_collaborators.
 */

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { connectTeamNetworkFollows } from "@/lib/social/connect-team-follows";
import type { MemberRole } from "@/lib/team/roles";
import { normalizeAreas, type AreaGrants } from "@/lib/team/areas";

function sha256HexServer(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export type PendingTeamInviteContext = {
  member: {
    id: string;
    artist_id: string;
    invited_email: string | null;
    role: MemberRole;
    status: string;
    invited_by: string;
    expires_at: string | null;
    areas: AreaGrants;
    relationship_label: string | null;
    invite_message: string | null;
  };
  artist: {
    id: string;
    name: string;
  };
};

export async function resolveTeamInvite(
  rawToken: string | undefined | null
): Promise<PendingTeamInviteContext | null> {
  if (!rawToken || rawToken.length < 16 || rawToken.length > 256) return null;

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    console.error(
      "[tempo] team invite lookup failed — SUPABASE_SERVICE_ROLE_KEY missing or invalid:",
      err instanceof Error ? err.message : err
    );
    return null;
  }

  const tokenHash = sha256HexServer(rawToken);

  const { data: member, error } = await admin
    .from("artist_members")
    .select("id, artist_id, invited_email, role, areas, relationship_label, invite_message, status, invited_by, expires_at")
    .eq("invite_token_hash", tokenHash)
    .maybeSingle();

  if (error || !member) return null;
  if (member.status !== "pending") return null;
  if (member.expires_at && new Date(member.expires_at).getTime() <= Date.now()) {
    return null;
  }

  const { data: artist, error: artistError } = await admin
    .from("artists")
    .select("id, name")
    .eq("id", member.artist_id)
    .maybeSingle();
  if (artistError || !artist) return null;

  return {
    member: {
      id: member.id,
      artist_id: member.artist_id,
      invited_email: member.invited_email,
      role: member.role,
      status: member.status,
      invited_by: member.invited_by,
      expires_at: member.expires_at,
      areas: normalizeAreas(member.areas),
      relationship_label: member.relationship_label ?? null,
      invite_message: member.invite_message ?? null,
    },
    artist: { id: artist.id, name: artist.name },
  };
}

const NO_STORE = { "Cache-Control": "no-store" } as const;
export function noStoreHeaders(extra?: Record<string, string>): Record<string, string> {
  return { ...NO_STORE, ...(extra ?? {}) };
}

export const TEAM_INVITE_UNAVAILABLE_MESSAGE =
  "This invite isn’t available. It may have expired, already been used, or the link is wrong.";

export type TeamMemberRow = {
  id: string;
  artist_id: string;
  user_id: string | null;
  invited_email: string | null;
  role: MemberRole;
  status: string;
  invited_by: string;
  expires_at: string | null;
};

export async function listPendingTeamInvitesForUser(userId: string): Promise<
  {
    id: string;
    artistId: string;
    artistName: string;
    artistEmblemUrl: string | null;
    role: MemberRole;
    createdAt: string;
    expiresAt: string | null;
    areas: AreaGrants;
    relationshipLabel: string | null;
    inviteMessage: string | null;
  }[]
> {
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("artist_members")
    .select("id, artist_id, role, areas, relationship_label, invite_message, created_at, expires_at")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error || !rows?.length) return [];

  const artistIds = Array.from(new Set(rows.map((row) => row.artist_id)));
  const { data: artists } = await admin
    .from("artists")
    .select("id, name, emblem_url")
    .in("id", artistIds);
  const byId = new Map((artists ?? []).map((a) => [a.id, a]));

  return rows
    .filter((row) => !row.expires_at || new Date(row.expires_at).getTime() > Date.now())
    .map((row) => {
      const artist = byId.get(row.artist_id);
      return {
        id: row.id,
        artistId: row.artist_id,
        artistName: artist?.name ?? "An artist",
        artistEmblemUrl: artist?.emblem_url ?? null,
        role: row.role as MemberRole,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        areas: normalizeAreas(row.areas),
        relationshipLabel: row.relationship_label ?? null,
        inviteMessage: row.invite_message ?? null,
      };
    });
}

export async function declinePendingTeamMember(input: {
  memberId: string;
  userId: string;
  actorName: string;
}): Promise<boolean> {
  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("artist_members")
    .update({ status: "declined", ended_reason: "invite_declined", invite_token_hash: null })
    .eq("id", input.memberId)
    .eq("user_id", input.userId)
    .eq("status", "pending")
    .select("id, artist_id, invited_by, role")
    .maybeSingle();
  if (error || !updated) return false;

  await admin.from("artist_membership_events").insert({
    artist_id: updated.artist_id,
    membership_id: updated.id,
    subject_user_id: input.userId,
    actor_user_id: input.userId,
    event_type: "declined",
    changes: { status: "declined" },
  }).then(() => {}, () => {});

  const { data: artist } = await admin
    .from("artists")
    .select("name")
    .eq("id", updated.artist_id)
    .maybeSingle();

  void admin
    .from("notifications")
    .insert({
      user_id: updated.invited_by,
      type: "team_invite_declined",
      title: `${input.actorName} declined your team invite`,
      body: `They didn’t join "${artist?.name ?? "this artist"}" as ${updated.role}.`,
      entity_type: "artist_member",
      entity_id: updated.id,
      link_url: "/team",
    })
    .then(
      () => {},
      () => {}
    );

  return true;
}

/**
 * Flip a pending artist_members row to active and notify the inviter.
 * Caller must already have checked that `userId` is allowed to accept.
 */
export async function activatePendingTeamMember(input: {
  memberId: string;
  userId: string;
  actorName: string;
}): Promise<{ artist_id: string; role: MemberRole; invited_by: string; artist_name: string } | null> {
  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("artist_members")
    .update({
      user_id: input.userId,
      status: "active",
      accepted_at: new Date().toISOString(),
      invite_token_hash: null,
    })
    .eq("id", input.memberId)
    .eq("status", "pending")
    .select("id, artist_id, role, invited_by")
    .maybeSingle();

  if (error || !updated) return null;

  await admin.from("artist_membership_events").insert({
    artist_id: updated.artist_id,
    membership_id: updated.id,
    subject_user_id: input.userId,
    actor_user_id: input.userId,
    event_type: "accepted",
    changes: { status: "active" },
  }).then(() => {}, () => {});

  const { data: artist } = await admin
    .from("artists")
    .select("id, name")
    .eq("id", updated.artist_id)
    .maybeSingle();
  const artistName = artist?.name ?? "this artist";

  void admin
    .from("notifications")
    .insert({
      user_id: updated.invited_by,
      type: "team_invite_accepted",
      title: `${input.actorName} accepted your team invite`,
      body: `They can now access "${artistName}" as ${updated.role}.`,
      entity_type: "artist_member",
      entity_id: updated.id,
      link_url: "/team",
    })
    .then(
      () => {},
      () => {}
    );

  try {
    await connectTeamNetworkFollows(admin, input.userId);
  } catch (error) {
    console.error("[team-invite] team follow connect pending", error);
  }

  return {
    artist_id: updated.artist_id,
    role: updated.role as MemberRole,
    invited_by: updated.invited_by,
    artist_name: artistName,
  };
}
