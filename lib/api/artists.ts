import { createClient } from "@/lib/supabase/client";
import { buildArtistAssetPath, deleteFile, uploadFile } from "@/lib/storage";
import { DEFAULT_ARTIST_NAME } from "@/lib/constants";
import type { Artist, ArtistUpdate } from "@/lib/types";

export async function fetchArtists(): Promise<Artist[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("artists")
    .select("*")
    .order("sort", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createArtist(name: string, sort: number): Promise<Artist> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("artists")
    .insert({ name, sort })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateArtist(id: string, patch: ArtistUpdate): Promise<Artist> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("artists")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function renameArtist(id: string, name: string): Promise<Artist> {
  return updateArtist(id, { name });
}

export async function updateArtistPalette(id: string, palette_id: string): Promise<Artist> {
  return updateArtist(id, { palette_id });
}

/** Counts used for the destructive-delete confirmation (spaces/tracks that go with the artist). */
export async function countArtistContents(
  id: string
): Promise<{ spaces: number; tracks: number }> {
  const supabase = createClient();
  const { data: spaces, error: spacesError } = await supabase
    .from("spaces")
    .select("id")
    .eq("artist_id", id);
  if (spacesError) throw spacesError;
  const spaceIds = (spaces ?? []).map((s) => s.id);
  if (spaceIds.length === 0) return { spaces: 0, tracks: 0 };

  const { count, error: tracksError } = await supabase
    .from("tracks")
    .select("id", { count: "exact", head: true })
    .in("space_id", spaceIds);
  if (tracksError) throw tracksError;
  return { spaces: spaceIds.length, tracks: count ?? 0 };
}

export async function deleteArtist(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("artists").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderArtists(
  ordered: { id: string; sort: number }[]
): Promise<void> {
  const supabase = createClient();
  const results = await Promise.all(
    ordered.map(({ id, sort }) =>
      supabase.from("artists").update({ sort }).eq("id", id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

async function uploadArtistImage(
  artistId: string,
  kind: "logo" | "banner",
  file: File
): Promise<string> {
  const path = buildArtistAssetPath({ artistId, kind, filename: file.name });
  await uploadFile(path, file, { contentType: file.type || undefined });
  return path;
}

/** Replaces any existing logo (old file is deleted best-effort after the swap). */
export async function uploadArtistLogo(artist: Artist, file: File): Promise<Artist> {
  const path = await uploadArtistImage(artist.id, "logo", file);
  const updated = await updateArtist(artist.id, { logo_url: path });
  if (artist.logo_url && artist.logo_url !== path) {
    try {
      await deleteFile(artist.logo_url);
    } catch {
      /* best-effort */
    }
  }
  return updated;
}

/** Sets an image banner; clears any flat banner_color since only one applies. */
export async function uploadArtistBanner(artist: Artist, file: File): Promise<Artist> {
  const path = await uploadArtistImage(artist.id, "banner", file);
  const updated = await updateArtist(artist.id, {
    banner_url: path,
    banner_color: null,
  });
  if (artist.banner_url && artist.banner_url !== path) {
    try {
      await deleteFile(artist.banner_url);
    } catch {
      /* best-effort */
    }
  }
  return updated;
}

/** Sets a flat color banner; clears any image banner. */
export async function setArtistBannerColor(
  artist: Artist,
  color: string | null
): Promise<Artist> {
  const updated = await updateArtist(artist.id, {
    banner_color: color,
    banner_url: null,
  });
  if (artist.banner_url) {
    try {
      await deleteFile(artist.banner_url);
    } catch {
      /* best-effort */
    }
  }
  return updated;
}

export async function clearArtistLogo(artist: Artist): Promise<Artist> {
  const updated = await updateArtist(artist.id, { logo_url: null });
  if (artist.logo_url) {
    try {
      await deleteFile(artist.logo_url);
    } catch {
      /* best-effort */
    }
  }
  return updated;
}

/** Seed one default artist when the user has none (first sign-in). */
export async function ensureDefaultArtist(): Promise<Artist> {
  const existing = await fetchArtists();
  if (existing.length > 0) return existing[0];
  return createArtist(DEFAULT_ARTIST_NAME, 0);
}
