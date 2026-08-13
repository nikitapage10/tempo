import { createClient } from "@/lib/supabase/client";
import { generateOpaqueToken, sha256Hex, siteOrigin } from "@/lib/tokens";
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

/** Artists the signed-in user is an active member of (not owner). Used to widen the artist switcher for team accounts. */
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
  invitedEmail: string;
  role: MemberRole;
  /** Overrides for the role's stock preset; unset keys fall back to the preset. */
  areaOverrides?: AreaGrants;
  expiresAt?: string | null;
};

export type CreatedTeamInvite = {
  member: ArtistMember;
  /** Raw token — only ever returned once. */
  rawToken: string;
  /** Whether the invite email actually sent — false with a reason if RESEND isn't configured or the send failed. The copyable link (teamInviteUrl) always works as a fallback either way. */
  emailSent: boolean;
  emailReason?: string;
};

function defaultInviteExpiry(days = 14): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export async function inviteMember(input: InviteMemberInput): Promise<CreatedTeamInvite> {
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) {
    throw new Error("You’re signed out — sign in again, then retry.");
  }

  const rawToken = generateOpaqueToken();
  const tokenHash = await sha256Hex(rawToken);
  const areas = { ...presetForRole(input.role), ...input.areaOverrides };

  const { data, error } = await supabase
    .from("artist_members")
    .insert({
      artist_id: input.artistId,
      invited_email: input.invitedEmail.trim().toLowerCase(),
      role: input.role,
      areas,
      status: "pending",
      invited_by: userData.user.id,
      invite_token_hash: tokenHash,
      expires_at: input.expiresAt || defaultInviteExpiry(),
    })
    .select()
    .single();
  if (error) {
    const msg = error.message || "Couldn’t create that invite — try again.";
    if (isMissingArtistMembersSchema({ message: msg })) {
      throw new Error(
        "Team accounts aren’t set up in the database yet — run migrations 089 and 090 in Supabase, then try again."
      );
    }
    throw new Error(msg);
  }

  const member = fromRow(data);

  // Best-effort: the row is already created either way, so a failed send
  // never blocks the invite — the artist can still copy/share the link.
  let emailSent = false;
  let emailReason: string | undefined;
  try {
    const res = await fetch("/api/team-invite/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: member.id, rawToken }),
    });
    const body = await res.json().catch(() => ({}));
    emailSent = !!body.sent;
    emailReason = body.reason;
  } catch {
    emailReason = "network_error";
  }

  return { member, rawToken, emailSent, emailReason };
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
