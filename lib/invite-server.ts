/**
 * Server-only collaborator invite validation — SECURITY-AND-PERMISSIONS.md §T4.
 *
 * Mirrors lib/guest-review.ts's pattern: hash the raw token, look the
 * pending invite up via the service-role admin client (RLS never grants
 * anon SELECT on track_collaborators by token), and fail closed on any
 * missing/expired/already-used state.
 */

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

function sha256HexServer(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export type PendingInviteContext = {
  collaborator: {
    id: string;
    track_id: string;
    invited_email: string;
    role: string;
    status: string;
    invited_by: string;
    expires_at: string | null;
  };
  track: {
    id: string;
    title: string;
  };
};

/** Looks up a pending, non-expired invite by raw token. Null on any failure mode. */
export async function resolveInvite(
  rawToken: string | undefined | null
): Promise<PendingInviteContext | null> {
  if (!rawToken || rawToken.length < 16 || rawToken.length > 256) return null;

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    // Fail closed for guests, but make the cause obvious in local/server logs.
    console.error(
      "[tempo] invite lookup failed — SUPABASE_SERVICE_ROLE_KEY missing or invalid:",
      err instanceof Error ? err.message : err
    );
    return null;
  }

  const tokenHash = sha256HexServer(rawToken);

  const { data: collaborator, error } = await admin
    .from("track_collaborators")
    .select("id, track_id, invited_email, role, status, invited_by, expires_at")
    .eq("invite_token_hash", tokenHash)
    .maybeSingle();

  if (error || !collaborator) return null;
  if (collaborator.status !== "pending") return null;
  if (collaborator.expires_at && new Date(collaborator.expires_at).getTime() <= Date.now()) {
    return null;
  }

  const { data: track, error: trackError } = await admin
    .from("tracks")
    .select("id, title")
    .eq("id", collaborator.track_id)
    .maybeSingle();
  if (trackError || !track) return null;

  return {
    collaborator: {
      id: collaborator.id,
      track_id: collaborator.track_id,
      invited_email: collaborator.invited_email,
      role: collaborator.role,
      status: collaborator.status,
      invited_by: collaborator.invited_by,
      expires_at: collaborator.expires_at,
    },
    track: { id: track.id, title: track.title },
  };
}

const NO_STORE = { "Cache-Control": "no-store" } as const;
export function noStoreHeaders(extra?: Record<string, string>): Record<string, string> {
  return { ...NO_STORE, ...(extra ?? {}) };
}

export const INVITE_UNAVAILABLE_MESSAGE =
  "This invite isn’t available. It may have expired, already been used, or the link is wrong.";
