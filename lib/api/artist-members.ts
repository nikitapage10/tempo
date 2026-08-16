import { createClient } from "@/lib/supabase/client";
import { siteOrigin } from "@/lib/tokens";
import { normalizeAreas, type AreaGrants } from "@/lib/team/areas";
import type { MemberRole } from "@/lib/team/roles";

export type ArtistMemberStatus = "pending" | "active" | "suspended" | "revoked" | "declined";

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
  relationshipLabel: string | null;
  inviteMessage: string | null;
  suspendedAt: string | null;
  revokedAt: string | null;
  updatedAt: string | null;
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
  relationship_label?: string | null;
  invite_message?: string | null;
  suspended_at?: string | null;
  revoked_at?: string | null;
  updated_at?: string | null;
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
    relationshipLabel: r.relationship_label ?? null,
    inviteMessage: r.invite_message ?? null,
    suspendedAt: r.suspended_at ?? null,
    revokedAt: r.revoked_at ?? null,
    updatedAt: r.updated_at ?? null,
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
): Promise<Pick<ArtistMember, "id" | "artistId" | "userId" | "role" | "status" | "areas">[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("artist_members")
    .select("id, artist_id, user_id, role, status, areas")
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
    areas: normalizeAreas(r.areas),
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
  relationshipLabel?: string;
  inviteMessage?: string;
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
      relationshipLabel: input.relationshipLabel?.trim() || null,
      inviteMessage: input.inviteMessage?.trim() || null,
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
  areas: AreaGrants;
  relationshipLabel: string | null;
  inviteMessage: string | null;
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
    .update({ role })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function revokeMember(id: string): Promise<ArtistMember> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("end_artist_member_access", {
    p_membership_id: id,
    p_assignment_plan: {},
  });
  if (error) throw error;
  const { data: row, error: readError } = await supabase.from("artist_members").select("*").eq("id", id).single();
  if (readError) throw readError;
  void data;
  return fromRow(row);
}

export type MemberOffboardingPreview = { tasks: number; reviews: number; events: number };

export async function previewMemberOffboarding(id: string): Promise<MemberOffboardingPreview> {
  const { data, error } = await createClient().rpc("preview_artist_member_offboarding", {
    p_membership_id: id,
  });
  if (error) throw error;
  const row = data as Record<string, unknown>;
  return { tasks: Number(row.tasks ?? 0), reviews: Number(row.reviews ?? 0), events: Number(row.events ?? 0) };
}

export type MembershipEvent = { id: string; eventType: string; changes: Record<string, unknown>; createdAt: string };
export async function listMembershipEvents(artistId: string, membershipId: string): Promise<MembershipEvent[]> {
  const { data, error } = await createClient().from("artist_membership_events").select("id,event_type,changes,created_at").eq("artist_id", artistId).eq("membership_id", membershipId).order("created_at", { ascending: false }).limit(50);
  if (error) {
    if (/artist_membership_events|schema cache/i.test(error.message)) return [];
    throw error;
  }
  return (data ?? []).map((row) => ({ id: row.id, eventType: row.event_type, changes: row.changes as Record<string, unknown>, createdAt: row.created_at }));
}

export async function suspendMember(id: string): Promise<void> {
  const { error } = await createClient().rpc("suspend_artist_member", { p_membership_id: id });
  if (error) throw error;
}

export async function resumeMember(id: string): Promise<void> {
  const { error } = await createClient().rpc("resume_artist_member", { p_membership_id: id });
  if (error) throw error;
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
