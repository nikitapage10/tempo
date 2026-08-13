import { createClient } from "@/lib/supabase/client";
import { generateOpaqueToken, sha256Hex, siteOrigin } from "@/lib/tokens";
import type { CollaboratorRole, TrackCollaborator } from "@/lib/types";

export async function listCollaborators(
  trackId: string
): Promise<TrackCollaborator[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("track_collaborators")
    .select("*")
    .eq("track_id", trackId)
    .order("created_at", { ascending: false });
  if (error) {
    // Before migration 009, treat as empty so the People panel still loads.
    if (/track_collaborators|schema cache|does not exist/i.test(error.message)) {
      return [];
    }
    throw new Error(error.message);
  }
  return hydrateCollaboratorProfiles(data ?? []);
}

/** Strip @ and case so a typed handle matches the network profile. */
export function normalizeCollaboratorHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

export type InviteCollaboratorInput = {
  trackId: string;
  invitedEmail: string;
  role: CollaboratorRole;
  expiresAt?: string | null;
};

export type CreatedInvite = {
  collaborator: TrackCollaborator;
  /** Raw token — only ever returned once. Not recoverable after this call. */
  rawToken: string;
};

function defaultInviteExpiry(days = 14): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Invites a collaborator by email. Only the token's SHA-256 hash is stored. */
export async function invite(
  input: InviteCollaboratorInput
): Promise<CreatedInvite> {
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) {
    throw new Error("You’re signed out — sign in again, then retry.");
  }

  const rawToken = generateOpaqueToken();
  const tokenHash = await sha256Hex(rawToken);

  const { data, error } = await supabase
    .from("track_collaborators")
    .insert({
      track_id: input.trackId,
      invited_email: input.invitedEmail.trim().toLowerCase(),
      role: input.role,
      status: "pending",
      invited_by: userData.user.id,
      invite_token_hash: tokenHash,
      expires_at: input.expiresAt || defaultInviteExpiry(),
    })
    .select()
    .single();
  if (error) {
    const msg = error.message || "Couldn’t create that invite — try again.";
    // Common before migrations 001–011 are applied in Supabase.
    if (/track_collaborators|schema cache|does not exist/i.test(msg)) {
      throw new Error(
        "Collaboration isn’t set up in the database yet — run migrations 001–011 in Supabase (or paste migrations/_run_all_001_to_011.sql), then try again."
      );
    }
    throw new Error(msg);
  }

  return { collaborator: data, rawToken };
}

async function hydrateCollaboratorProfiles(
  rows: TrackCollaborator[]
): Promise<TrackCollaborator[]> {
  const userIds = Array.from(
    new Set(rows.map((row) => row.user_id).filter((id): id is string => !!id))
  );
  if (userIds.length === 0) return rows;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("artist_profiles")
    .select("owner_user_id, display_name, handle, emblem_url")
    .in("owner_user_id", userIds);
  if (error) return rows;
  const byUser = new Map<
    string,
    { display_name: string; handle: string | null; emblem_url: string | null }
  >();
  for (const profile of data ?? []) {
    const ownerId = profile.owner_user_id as string;
    const next = {
      display_name: (profile.display_name as string) ?? "Artist",
      handle: (profile.handle as string | null) ?? null,
      emblem_url: (profile.emblem_url as string | null) ?? null,
    };
    const current = byUser.get(ownerId);
    if (!current || (!current.handle && next.handle)) byUser.set(ownerId, next);
  }
  return rows.map((row) => {
    if (!row.user_id) return row;
    const profile = byUser.get(row.user_id);
    if (!profile) return row;
    return { ...row, ...profile };
  });
}

export type IncludeArtistCollaboratorInput = {
  trackId: string;
  role: CollaboratorRole;
  profileId?: string;
  handle?: string;
};

/**
 * Put an existing TEMPO artist on this track. They already have an account,
 * so they become an active collaborator — no email invite link.
 */
export async function includeArtistCollaborator(
  input: IncludeArtistCollaboratorInput
): Promise<TrackCollaborator> {
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) {
    throw new Error("You’re signed out — sign in again, then retry.");
  }

  let profileQuery = supabase
    .from("artist_profiles")
    .select("id, owner_user_id, artist_id, handle, display_name, visibility");
  if (input.profileId) {
    profileQuery = profileQuery.eq("id", input.profileId);
  } else if (input.handle) {
    const handle = normalizeCollaboratorHandle(input.handle);
    if (!handle) throw new Error("Type a handle, or pick someone you follow.");
    profileQuery = profileQuery.eq("handle", handle);
  } else {
    throw new Error("Pick a TEMPO artist or type their handle.");
  }

  const { data: profile, error: profileError } = await profileQuery.maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (!profile?.owner_user_id) {
    throw new Error("Couldn’t find that artist on TEMPO.");
  }
  if (profile.owner_user_id === userData.user.id) {
    throw new Error("You’re already the owner of this track.");
  }

  const { data: artist } = await supabase
    .from("artists")
    .select("demo_kind")
    .eq("id", profile.artist_id)
    .maybeSingle();
  if (artist?.demo_kind) {
    throw new Error("That’s a demo artist — pick a real TEMPO member.");
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("track_collaborators")
    .select("*")
    .eq("track_id", input.trackId)
    .eq("user_id", profile.owner_user_id)
    .limit(1);
  if (existingError && !/track_collaborators|schema cache|does not exist/i.test(existingError.message)) {
    throw new Error(existingError.message);
  }
  const existing = existingRows?.[0] ?? null;
  if (existing && existing.status !== "revoked") {
    throw new Error("They’re already on this track.");
  }

  const payload = {
    track_id: input.trackId,
    user_id: profile.owner_user_id as string,
    invited_email: null,
    role: input.role,
    status: "active" as const,
    invited_by: userData.user.id,
    invite_token_hash: null,
    expires_at: null,
    accepted_at: new Date().toISOString(),
  };

  const write = existing
    ? supabase.from("track_collaborators").update(payload).eq("id", existing.id).select().single()
    : supabase.from("track_collaborators").insert(payload).select().single();
  const { data, error } = await write;
  if (error) {
    const msg = error.message || "Couldn’t add that artist — try again.";
    if (/track_collaborators|schema cache|does not exist/i.test(msg)) {
      throw new Error(
        "Collaboration isn’t set up in the database yet — run migrations 001–011 in Supabase, then try again."
      );
    }
    throw new Error(msg);
  }

  const [hydrated] = await hydrateCollaboratorProfiles([data]);
  return hydrated;
}

export async function revokeCollaborator(id: string): Promise<TrackCollaborator> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("track_collaborators")
    .update({ status: "revoked" })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateRole(
  id: string,
  role: CollaboratorRole
): Promise<TrackCollaborator> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("track_collaborators")
    .update({ role })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Build the shareable invite URL from a raw token (only usable right after invite()). */
export function inviteUrl(rawToken: string): string {
  return `${siteOrigin()}/invite/${rawToken}`;
}

/**
 * Accepting an invite means looking a row up by invite_token_hash and
 * setting user_id + status='active' — but RLS on track_collaborators only
 * lets the track owner or the already-linked user read/write a row, so an
 * unauthenticated (or newly-signing-up) invitee can't do this from the
 * browser directly. Delegates to the server route (service role) that
 * validates the token, checks expires_at/status, and performs the update.
 */
export async function acceptInvite(rawToken: string): Promise<{ track_id: string }> {
  const res = await fetch(`/api/invite/${rawToken}`, { method: "POST" });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || "Couldn’t accept that invite.");
  }
  return body;
}

/** The current signed-in user's active role on a track, or null if none. */
export async function fetchMyRole(trackId: string): Promise<CollaboratorRole | null> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data, error } = await supabase
    .from("track_collaborators")
    .select("role")
    .eq("track_id", trackId)
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return data?.role ?? null;
}
