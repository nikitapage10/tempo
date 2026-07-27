/**
 * Server-only guest review link validation — SECURITY-AND-PERMISSIONS.md §T1/T2.
 *
 * Every /api/review/[token]/* route calls `resolveGuestLink` first. It hashes
 * the raw token, looks it up via the service-role admin client (RLS never
 * grants anon SELECT on guest_review_links), and fails closed on any
 * missing/revoked/expired state. Callers must never leak the distinction
 * between "not found" and "revoked"/"expired" to the client.
 */

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * SHA-256 hex digest for server-only token hashing. This file is imported
 * exclusively by /api/review/* route handlers (Node.js runtime), never by
 * client components, so it can use Node's built-in `crypto` directly.
 */
function sha256HexServer(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export type GuestReviewContext = {
  link: {
    id: string;
    track_id: string;
    version_id: string;
    allow_comments: boolean;
    allow_download: boolean;
    label: string | null;
  };
  track: {
    id: string;
    title: string;
    artist_alias: string | null;
    artwork_url: string | null;
  };
  version: {
    id: string;
    version_no: number;
    label: string | null;
    changelog: string | null;
    file_url: string;
    duration: number | null;
    created_at: string;
  };
};

/**
 * Validates a raw guest token end-to-end: hash lookup, revoked/expired
 * checks, and that the linked track + version still exist. Returns `null`
 * for every failure mode so route handlers can respond with one generic
 * "unavailable" message (never reveal which check failed).
 */
export async function resolveGuestLink(
  rawToken: string | undefined | null
): Promise<GuestReviewContext | null> {
  if (!rawToken || rawToken.length < 16 || rawToken.length > 256) return null;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return null;
  }

  const tokenHash = sha256HexServer(rawToken);

  const { data: link, error: linkError } = await admin
    .from("guest_review_links")
    .select(
      "id, track_id, version_id, allow_comments, allow_download, label, expires_at, revoked_at"
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (linkError || !link) return null;
  if (link.revoked_at) return null;
  if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
    return null;
  }

  const { data: version, error: versionError } = await admin
    .from("versions")
    .select("id, track_id, version_no, label, changelog, file_url, duration, created_at")
    .eq("id", link.version_id)
    .maybeSingle();
  if (versionError || !version || version.track_id !== link.track_id) return null;

  const { data: track, error: trackError } = await admin
    .from("tracks")
    .select("id, title, artist_alias, artwork_url")
    .eq("id", link.track_id)
    .maybeSingle();
  if (trackError || !track) return null;

  // Best-effort — never blocks the response on failure.
  void admin
    .from("guest_review_links")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("id", link.id)
    .then(
      () => {},
      () => {}
    );

  return {
    link: {
      id: link.id,
      track_id: link.track_id,
      version_id: link.version_id,
      allow_comments: link.allow_comments,
      allow_download: link.allow_download,
      label: link.label,
    },
    track: {
      id: track.id,
      title: track.title,
      artist_alias: track.artist_alias,
      artwork_url: track.artwork_url,
    },
    version: {
      id: version.id,
      version_no: version.version_no,
      label: version.label,
      changelog: version.changelog,
      file_url: version.file_url,
      duration: version.duration,
      created_at: version.created_at,
    },
  };
}

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** Standard headers for every guest API response — never cache guest data. */
export function noStoreHeaders(extra?: Record<string, string>): Record<string, string> {
  return { ...NO_STORE, ...(extra ?? {}) };
}

/** Generic, non-leaking message for any invalid/expired/revoked guest link. */
export const GUEST_LINK_UNAVAILABLE_MESSAGE =
  "This review link isn’t available. It may have expired, been revoked, or the address is wrong.";

/** Burst limit — see SECURITY-AND-PERMISSIONS.md §T8. */
export const GUEST_COMMENT_BURST_LIMIT = 10;
export const GUEST_COMMENT_BURST_WINDOW_MS = 10 * 60 * 1000;

export const GUEST_NAME_MAX_LEN = 60;
export const GUEST_COMMENT_MAX_LEN = 2000;
