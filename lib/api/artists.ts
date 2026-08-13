import { createClient } from "@/lib/supabase/client";
import { buildArtistAssetPath, deleteFile, uploadFile } from "@/lib/storage";
import { DEFAULT_ARTIST_NAME } from "@/lib/constants";
import { fetchMyMemberProfile } from "@/lib/api/member-profile";
import {
  membershipArtists,
  ownedPersonalHomes,
  ownedPersonalWorkspace,
} from "@/lib/workspace-mode";
import { isPlaceholderPersonName } from "@/lib/auth/person-name";
import type { Artist, ArtistUpdate, OriginStatus } from "@/lib/types";

function mapArtist(row: Record<string, unknown>): Artist {
  return {
    ...(row as unknown as Artist),
    emblem_url: (row.emblem_url as string | null) ?? null,
    ice_color: (row.ice_color as string | null) ?? null,
    amber_color: (row.amber_color as string | null) ?? null,
    banner_color_end: (row.banner_color_end as string | null) ?? null,
    spotify_artist_id: (row.spotify_artist_id as string | null) ?? null,
    soundcloud_user_id: (row.soundcloud_user_id as string | null) ?? null,
    apple_artist_id: (row.apple_artist_id as string | null) ?? null,
    origin_status: (row.origin_status as Artist["origin_status"]) ?? null,
    origin_completed_at: (row.origin_completed_at as string | null) ?? null,
    origin_skipped_at: (row.origin_skipped_at as string | null) ?? null,
    demo_kind: (row.demo_kind as string | null) ?? null,
    workspace_kind: row.workspace_kind === "personal" ? "personal" : "artist",
  };
}

function isMissingWorkspaceKind(error: { message?: string }): boolean {
  return /workspace_kind|schema cache|does not exist/i.test(error?.message ?? "");
}

export async function fetchArtists(): Promise<Artist[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("artists")
    .select("*")
    .order("sort", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => mapArtist(row as Record<string, unknown>));
}

export type CreateArtistOptions = {
  workspaceKind?: "artist" | "personal";
  originStatus?: OriginStatus;
  originCompletedAt?: string | null;
};

export async function createArtist(
  name: string,
  sort: number,
  options: CreateArtistOptions = {}
): Promise<Artist> {
  const supabase = createClient();
  const row: Record<string, unknown> = { name, sort };
  if (options.workspaceKind) row.workspace_kind = options.workspaceKind;
  if (options.originStatus) row.origin_status = options.originStatus;
  if (options.originCompletedAt) row.origin_completed_at = options.originCompletedAt;
  const { data, error } = await supabase.from("artists").insert(row).select().single();
  if (error) throw error;
  return mapArtist(data as Record<string, unknown>);
}

async function personalWorkspaceName(): Promise<string> {
  try {
    const profile = await fetchMyMemberProfile();
    const named = profile?.displayName?.trim();
    if (named) return named.slice(0, 60);
  } catch {
    /* profile table may not exist yet */
  }
  return "Home";
}

async function markWorkspacePersonal(
  id: string,
  name?: string
): Promise<Artist | null> {
  const supabase = createClient();
  const patch: Record<string, unknown> = {
    workspace_kind: "personal",
    origin_status: "legacy_complete",
  };
  if (name) patch.name = name;
  const { data, error } = await supabase
    .from("artists")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    if (isMissingWorkspaceKind(error)) {
      const fallback: Record<string, unknown> = { origin_status: "legacy_complete" };
      if (name) fallback.name = name;
      const retry = await supabase
        .from("artists")
        .update(fallback)
        .eq("id", id)
        .select()
        .single();
      if (retry.error || !retry.data) return null;
      return mapArtist(retry.data as Record<string, unknown>);
    }
    return null;
  }
  return mapArtist(data as Record<string, unknown>);
}

/**
 * Collapse teammate-owned Artist rows that were minted by the old invite
 * path (named from email, never Origin) into a single personal home.
 */
async function repairTeammateHomes(
  existing: Artist[],
  userId: string,
  email: string | null | undefined,
  preferredName: string
): Promise<Artist[]> {
  if (membershipArtists(existing, userId).length === 0) return existing;
  const homes = ownedPersonalHomes(existing, userId);
  if (homes.length === 0) return existing;

  const keeper =
    homes.find((a) => a.workspace_kind === "personal") ??
    homes.find((a) => a.emblem_url || a.logo_url) ??
    homes[0];
  let next = existing;
  const rename = isPlaceholderPersonName(keeper.name, email) ? preferredName : undefined;

  if (keeper.workspace_kind !== "personal" || rename) {
    const updated = await markWorkspacePersonal(keeper.id, rename);
    if (updated) {
      next = next.map((a) => (a.id === updated.id ? updated : a));
    }
  }

  for (const extra of homes.filter((a) => a.id !== keeper.id)) {
    try {
      const counts = await countArtistContents(extra.id);
      if (counts.spaces === 0 && counts.tracks === 0) {
        await deleteArtist(extra.id);
        next = next.filter((a) => a.id !== extra.id);
      } else if (extra.workspace_kind !== "personal") {
        const updated = await markWorkspacePersonal(extra.id);
        if (updated) next = next.map((a) => (a.id === updated.id ? updated : a));
      }
    } catch {
      /* UI still hides extras via ownedMusicArtists */
    }
  }
  return next;
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
  return mapArtist(data as Record<string, unknown>);
}

export async function renameArtist(id: string, name: string): Promise<Artist> {
  return updateArtist(id, { name });
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
  kind: "logo" | "emblem" | "banner",
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
    void deleteFile(artist.logo_url).catch(() => {});
  }
  return updated;
}

/** Square identity mark used in the rail list and Settings chip. */
export async function uploadArtistEmblem(
  artist: Artist,
  file: File
): Promise<Artist> {
  const path = await uploadArtistImage(artist.id, "emblem", file);
  const updated = await updateArtist(artist.id, { emblem_url: path });
  if (artist.emblem_url && artist.emblem_url !== path) {
    void deleteFile(artist.emblem_url).catch(() => {});
  }
  return updated;
}

/** Sets an image banner; clears any flat banner_color since only one applies. */
export async function uploadArtistBanner(artist: Artist, file: File): Promise<Artist> {
  const path = await uploadArtistImage(artist.id, "banner", file);
  const updated = await updateArtist(artist.id, {
    banner_url: path,
    banner_color: null,
    banner_color_end: null,
  });
  if (artist.banner_url && artist.banner_url !== path) {
    void deleteFile(artist.banner_url).catch(() => {});
  }
  return updated;
}

/** Sets a flat color banner (optional second stop = gradient); clears any image. */
export async function setArtistBannerColor(
  artist: Artist,
  color: string | null,
  colorEnd: string | null = null
): Promise<Artist> {
  const updated = await updateArtist(artist.id, {
    banner_color: color,
    banner_color_end: color ? colorEnd : null,
    banner_url: null,
  });
  if (artist.banner_url) {
    void deleteFile(artist.banner_url).catch(() => {});
  }
  return updated;
}

/** Free Cool / Warm accent overrides. Pass nulls to clear back to the palette. */
export async function setArtistCustomAccent(
  artist: Artist,
  colors: { ice: string | null; amber: string | null }
): Promise<Artist> {
  return updateArtist(artist.id, {
    ice_color: colors.ice,
    amber_color: colors.amber,
  });
}

/** Pick a curated palette and clear any free Cool/Warm overrides. */
export async function updateArtistPalette(id: string, palette_id: string): Promise<Artist> {
  return updateArtist(id, {
    palette_id,
    ice_color: null,
    amber_color: null,
  });
}

export async function clearArtistLogo(artist: Artist): Promise<Artist> {
  const updated = await updateArtist(artist.id, { logo_url: null });
  if (artist.logo_url) {
    void deleteFile(artist.logo_url).catch(() => {});
  }
  return updated;
}

export async function clearArtistEmblem(artist: Artist): Promise<Artist> {
  const updated = await updateArtist(artist.id, { emblem_url: null });
  if (artist.emblem_url) {
    void deleteFile(artist.emblem_url).catch(() => {});
  }
  return updated;
}

let ensureArtistsInflight: Promise<Artist[]> | null = null;

/**
 * The artist list, seeding a default music artist when the user has none
 * (first sign-in), and a personal workspace when they work on someone else's
 * team but don't yet have a home of their own. Returns the list it already
 * read instead of leaving the caller to fetch it a second time.
 *
 * Concurrent calls share one in-flight promise so a refetch cannot mint
 * another home while the first insert is still landing.
 */
export async function ensureArtists(): Promise<Artist[]> {
  if (!ensureArtistsInflight) {
    ensureArtistsInflight = ensureArtistsOnce().finally(() => {
      ensureArtistsInflight = null;
    });
  }
  return ensureArtistsInflight;
}

async function userHasTeamOrCollabHome(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<boolean> {
  const [{ data: membership }, { count: collabCount }, { data: onboarding }] =
    await Promise.all([
      supabase
        .from("artist_members")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("track_collaborators")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "active"),
      // Someone the admin invited straight to the platform as a team member
      // has no artist_members row yet, and without this would be seeded a
      // music artist — which is what put Tracks and Board in their rail.
      supabase
        .from("member_onboarding")
        .select("member_role")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
  return (
    !!membership ||
    (collabCount ?? 0) > 0 ||
    onboarding?.member_role === "team_member"
  );
}

async function ensureArtistsOnce(): Promise<Artist[]> {
  const existing = await fetchArtists();
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  if (existing.length === 0) {
    if (userId && (await userHasTeamOrCollabHome(supabase, userId))) {
      try {
        const personal = await createArtist(await personalWorkspaceName(), 0, {
          workspaceKind: "personal",
          originStatus: "legacy_complete",
          originCompletedAt: new Date().toISOString(),
        });
        try {
          sessionStorage.setItem("tempo.preferPersonalHome", personal.id);
        } catch {
          /* ignore */
        }
        return [personal];
      } catch {
        return [];
      }
    }
    return [await createArtist(DEFAULT_ARTIST_NAME, 0)];
  }

  if (!userId) return existing;

  const hasMembership = membershipArtists(existing, userId).length > 0;
  const needsPersonalHome =
    hasMembership || (await userHasTeamOrCollabHome(supabase, userId));
  if (needsPersonalHome) {
    const preferredName = await personalWorkspaceName();
    const repaired = await repairTeammateHomes(
      existing,
      userId,
      userData.user?.email,
      preferredName
    );
    if (ownedPersonalWorkspace(repaired, userId)) return repaired;

    const owned = repaired.filter((a) => a.user_id === userId);
    try {
      const personal = await createArtist(preferredName, owned.length, {
        workspaceKind: "personal",
        originStatus: "legacy_complete",
        originCompletedAt: new Date().toISOString(),
      });
      try {
        sessionStorage.setItem("tempo.preferPersonalHome", personal.id);
      } catch {
        /* ignore */
      }
      return [...repaired, personal];
    } catch {
      // Migration 092 not applied yet — stay on the membership-visible list
      // rather than minting a music artist named from the email.
      return repaired;
    }
  }

  return existing;
}
