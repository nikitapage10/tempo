import { createClient } from "@/lib/supabase/client";
import { generateOpaqueToken, sha256Hex, siteOrigin } from "@/lib/tokens";
import type { GuestReviewLink } from "@/lib/types";

export async function listLinks(trackId: string): Promise<GuestReviewLink[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("guest_review_links")
    .select("*")
    .eq("track_id", trackId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type CreateGuestLinkInput = {
  trackId: string;
  versionId: string;
  label?: string | null;
  expiresAt?: string | null;
  allowComments?: boolean;
  allowDownload?: boolean;
};

export type CreatedGuestLink = {
  link: GuestReviewLink;
  /** Raw token — only ever returned once. Not recoverable after this call. */
  rawToken: string;
};

/**
 * Creates a guest review link. A cryptographically random token is generated
 * client-side; only its SHA-256 hash is stored. The raw token is returned
 * exactly once so the caller can show/copy the shareable URL.
 */
export async function createLink(
  input: CreateGuestLinkInput
): Promise<CreatedGuestLink> {
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("You’re signed out — sign in again, then retry.");

  const rawToken = generateOpaqueToken();
  const tokenHash = await sha256Hex(rawToken);

  const { data, error } = await supabase
    .from("guest_review_links")
    .insert({
      track_id: input.trackId,
      version_id: input.versionId,
      created_by: userData.user.id,
      token_hash: tokenHash,
      label: input.label?.trim() || null,
      expires_at: input.expiresAt || null,
      allow_comments: input.allowComments ?? true,
      allow_download: input.allowDownload ?? false,
    })
    .select()
    .single();
  if (error) throw error;

  return { link: data, rawToken };
}

export async function revokeLink(id: string): Promise<GuestReviewLink> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("guest_review_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Build the shareable guest review URL from a raw token (only usable right after createLink). */
export function guestLinkUrl(rawToken: string): string {
  return `${siteOrigin()}/review/${rawToken}`;
}
