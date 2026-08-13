/**
 * Server-only team invite validation — mirrors lib/invite-server.ts exactly,
 * against artist_members instead of track_collaborators.
 */

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MemberRole } from "@/lib/team/roles";

function sha256HexServer(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export type PendingTeamInviteContext = {
  member: {
    id: string;
    artist_id: string;
    invited_email: string;
    role: MemberRole;
    status: string;
    invited_by: string;
    expires_at: string | null;
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
    .select("id, artist_id, invited_email, role, status, invited_by, expires_at")
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
