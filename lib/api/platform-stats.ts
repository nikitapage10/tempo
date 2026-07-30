import { createClient } from "@/lib/supabase/client";

export type PlatformId = "spotify" | "soundcloud";

export type PlatformSnapshot = {
  id: string;
  artist_id: string;
  platform: PlatformId;
  captured_on: string;
  captured_at: string;
  followers: number | null;
  popularity: number | null;
  plays: number | null;
  likes: number | null;
  reposts: number | null;
  track_count: number | null;
  detail: Record<string, unknown> | null;
};

export type CatalogRelease = {
  id: number | string;
  name: string;
  releaseDate: string | null;
  trackCount: number | null;
  artworkUrl: string | null;
  genre?: string | null;
  albumType?: string | null;
  url: string | null;
};

export type PlatformCatalog = {
  name: string;
  url: string | null;
  releases: CatalogRelease[];
};

/** True when migration 024 hasn't been run yet. */
export function isMissingPlatformSchema(error: {
  message?: string;
  code?: string;
}): boolean {
  const msg = error?.message ?? "";
  return (
    /platform_snapshots/i.test(msg) ||
    /spotify_artist_id|soundcloud_user_id|apple_artist_id/i.test(msg)
  );
}

async function callPlatformApi<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/platforms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (json as { error?: string }).error ?? "That platform request failed."
    );
  }
  return json as T;
}

/** Every snapshot for one artist, oldest first — the trend lines read from this. */
export async function fetchPlatformSnapshots(
  artistId: string
): Promise<PlatformSnapshot[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("platform_snapshots")
    .select("*")
    .eq("artist_id", artistId)
    .order("captured_on", { ascending: true });
  if (error) {
    if (isMissingPlatformSchema(error)) return [];
    throw error;
  }
  return (data ?? []) as PlatformSnapshot[];
}

export async function searchPlatformArtists(
  platform: "spotify" | "apple",
  query: string
): Promise<{ id: string | number; name: string; followers?: number }[]> {
  const json = await callPlatformApi<{
    results: { id: string | number; name: string; followers?: number }[];
  }>({ action: "search", platform, query });
  return json.results;
}

export async function resolvePlatformLink(
  platform: PlatformId,
  input: string
): Promise<{ id: string; name: string }> {
  return callPlatformApi<{ id: string; name: string }>({
    action: "resolve",
    platform,
    input,
  });
}

const LINK_COLUMN: Record<string, string> = {
  spotify: "spotify_artist_id",
  soundcloud: "soundcloud_user_id",
  apple: "apple_artist_id",
};

export async function setPlatformLink(
  artistId: string,
  platform: "spotify" | "soundcloud" | "apple",
  platformId: string | null
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("artists")
    .update({ [LINK_COLUMN[platform]]: platformId })
    .eq("id", artistId);
  if (error) throw error;
}

/** Fetch today's numbers from the platform and store them. */
export async function refreshPlatform(
  artistId: string,
  platform: PlatformId
): Promise<PlatformSnapshot> {
  const json = await callPlatformApi<{ snapshot: PlatformSnapshot }>({
    action: "refresh",
    artistId,
    platform,
  });
  return json.snapshot;
}

/** Apple and Spotify are both catalog-only; neither exposes any metric. */
export async function fetchPlatformCatalog(
  artistId: string,
  platform: "apple" | "spotify"
): Promise<PlatformCatalog> {
  const json = await callPlatformApi<{ catalog: PlatformCatalog }>({
    action: "catalog",
    artistId,
    platform,
  });
  return json.catalog;
}
