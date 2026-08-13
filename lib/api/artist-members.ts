import { createClient } from "@/lib/supabase/client";
import { siteOrigin } from "@/lib/tokens";
import { normalizeAreas, type AreaGrants } from "@/lib/team/areas";
import { presetForRole, type MemberRole } from "@/lib/team/roles";

export type ArtistMemberStatus = "pending" | "active" | "revoked";

export type ArtistMember = {
  id: string;
  artistId: string;
  userId: string | null;
  invitedEmail: string | null;
  role: MemberRole;
  areas: AreaGrants;
  status: ArtistMemberStatus;
  invitedBy: string;
  expiresAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
};

type ArtistMemberRow = {
  id: string;
  artist_id: string;
  user_id: string | null;
  invited_email: string | null;
  role: MemberRole;
  areas: unknown;
  status: ArtistMemberStatus;
  invited_by: string;
  expires_at: string | null;
  accepted_at: string | null;
  created_at: string;
};

function fromRow(r: ArtistMemberRow): ArtistMember {
  return {
    id: r.id,
    artistId: r.artist_id,
    userId: r.user_id,
    invitedEmail: r.invited_email,
    role: r.role,
    areas: normalizeAreas(r.areas),
    status: r.status,
    invitedBy: r.invited_by,
    expiresAt: r.expires_at,
    acceptedAt: r.accepted_at,
    createdAt: r.created_at,
  };
}

/** Before migration 089 has run, this table doesn't exist yet — treat as empty rather than erroring the page. */
function isMissingArtistMembersSchema(error: { message?: string }): boolean {
  return /artist_members|schema cache|does not exist/i.test(error?.message ?? "");
}

export async function listArtistMembers(artistId: string): Promise<ArtistMember[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("artist_members")
    .select("*")
    .eq("artist_id", artistId)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingArtistMembersSchema(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map(fromRow);
}

/** Active teammates of an artist — safe columns only (no invite token/email). */
export async function listActiveTeamRoster(
  artistId: string
): Promise<Pick<ArtistMember, "id" | "artistId" | "userId" | "role" | "status">[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("artist_members")
    .select("id, artist_id, user_id, role, status")
    .eq("artist_id", artistId)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error) {
    if (isMissingArtistMembersSchema(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    artistId: r.artist_id,
    userId: r.user_id,
    role: r.role as MemberRole,
    status: r.status as ArtistMemberStatus,
  }));
}

export async function listMemberOfArtists(): Promise<{ artistId: string; role: MemberRole; areas: AreaGrants }[]> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];
  const { data, error } = await supabase
    .from("artist_members")
    .select("artist_id, role, areas")
    .eq("user_id", userData.user.id)
    .eq("status", "active");
  if (error) {
    if (isMissingArtistMembersSchema(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => ({
    artistId: r.artist_id,
    role: r.role as MemberRole,
    areas: normalizeAreas(r.areas),
  }));
}

export type InviteMemberInput = {
  artistId: string;
  role: MemberRole;
  invitedEmail?: string;
  handle?: string;
  profileId?: string;
  /** Overrides for the role's stock preset; unset keys fall back to the preset. */
  areaOverrides?: AreaGrants;
  expiresAt?: string | null;
};

export type CreatedTeamInvite = {
  kind: "existing" | "email";
  memberId: string;
  /** Raw token — only returned for people not already on TEMPO. */
  rawToken: string | null;
  /** Whether the invite email actually sent. Existing members also get an in-app notification. */
  emailSent: boolean;
  emailReason?: string;
};

export async function inviteMember(input: InviteMemberInput): Promise<CreatedTeamInvite> {
  const res = await fetch("/api/team-invite/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      artistId: input.artistId,
      role: input.role,
      email: input.invitedEmail?.trim() || null,
      handle: input.handle?.trim() || null,
      profileId: input.profileId || null,
      areaOverrides: input.areaOverrides,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Couldn’t send that invite.");
  }
  return {
    kind: body.kind === "existing" ? "existing" : "email",
    memberId: body.memberId,
    rawToken: typeof body.rawToken === "string" ? body.rawToken : null,
    emailSent: !!body.emailSent,
    emailReason: body.emailReason,
  };
}

export type PendingTeamInvite = {
  id: string;
  artistId: string;
  artistName: string;
  artistEmblemUrl: string | null;
  role: MemberRole;
  createdAt: string;
  expiresAt: string | null;
};

export async function fetchPendingTeamInvites(): Promise<PendingTeamInvite[]> {
  const res = await fetch("/api/team-invite/pending", { method: "GET" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Couldn’t load team invites.");
  }
  return Array.isArray(body.invites) ? body.invites : [];
}

export async function respondToTeamInvite(
  memberId: string,
  accept: boolean
): Promise<{ artistId?: string }> {
  const res = await fetch("/api/team-invite/respond", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberId, accept }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Couldn’t update that invite.");
  }
  return { artistId: typeof body.artist_id === "string" ? body.artist_id : undefined };
}

export async function updateMemberAreas(id: string, areas: AreaGrants): Promise<ArtistMember> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("artist_members")
    .update({ areas })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateMemberRole(id: string, role: MemberRole): Promise<ArtistMember> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("artist_members")
    .update({ role, areas: presetForRole(role) })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function revokeMember(id: string): Promise<ArtistMember> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("artist_members")
    .update({ status: "revoked" })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export function teamInviteUrl(rawToken: string): string {
  return `${siteOrigin()}/team-invite/${rawToken}`;
}

/** Mirrors acceptInvite() in lib/api/collaborators.ts — RLS can't let an unlinked invitee accept directly. */
export async function acceptTeamInvite(rawToken: string): Promise<{ artist_id: string }> {
  const res = await fetch(`/api/team-invite/${rawToken}`, { method: "POST" });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || "Couldn’t accept that invite.");
  }
  return body;
}
