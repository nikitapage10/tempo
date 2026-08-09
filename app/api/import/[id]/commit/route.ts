import { NextResponse, type NextRequest } from "next/server";
import {
  IMPORT_UNAVAILABLE_MESSAGE,
  deleteImportFiles,
  loadWorkspaceContext,
  noStoreHeaders,
  resolveImport,
  setImportStatus,
} from "@/lib/import-server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { toCommitPayload } from "@/lib/ai/commit-payload";
import { validatePlan } from "@/lib/ai/synthesize-plan";
import {
  fetchSpotifyTrackCatalog,
  fetchSpotifyTracks,
  type SpotifyCatalogTrack,
} from "@/lib/platforms/spotify";
import { buildStoragePath } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_SPOTIFY_ARTWORK_BYTES = 15 * 1024 * 1024;

function cachedSpotifyCatalog(
  summary: Record<string, unknown> | null,
  artistId: string,
): SpotifyCatalogTrack[] | null {
  const value = summary?.spotifyCatalog;
  if (!value || typeof value !== "object") return null;
  const snapshot = value as { artist?: { id?: unknown }; tracks?: unknown };
  if (snapshot.artist?.id !== artistId || !Array.isArray(snapshot.tracks)) return null;
  if (!snapshot.tracks.every(
    (track) => track && typeof track === "object" && typeof (track as { id?: unknown }).id === "string"
  )) return null;
  return snapshot.tracks as SpotifyCatalogTrack[];
}

function isSpotifyArtworkHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "i.scdn.co" ||
    /^image-cdn-[a-z0-9-]+\.spotifycdn\.com$/.test(normalized)
  );
}

function safeSpotifyArtworkUrl(value: string | null): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && isSpotifyArtworkHostname(url.hostname)
      ? url
      : null;
  } catch {
    return null;
  }
}

async function copySpotifyArtwork(
  ctx: NonNullable<Awaited<ReturnType<typeof resolveImport>>>,
  userStorage: ReturnType<typeof createServerClient>,
  trackId: string,
  trackTitle: string,
  source: string
): Promise<void> {
  const url = safeSpotifyArtworkUrl(source);
  if (!url) throw new Error("Spotify returned an unexpected artwork address.");

  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Artwork download failed (${response.status}).`);
  if (!safeSpotifyArtworkUrl(response.url)) {
    throw new Error("Spotify redirected artwork to an unexpected address.");
  }

  const contentType = (response.headers.get("content-type") ?? "").split(";")[0];
  const extension =
    contentType === "image/png"
      ? "png"
      : contentType === "image/webp"
        ? "webp"
        : contentType === "image/jpeg"
          ? "jpg"
          : null;
  if (!extension) throw new Error("Spotify returned an unsupported artwork file.");

  const declaredSize = Number(response.headers.get("content-length") ?? 0);
  if (declaredSize > MAX_SPOTIFY_ARTWORK_BYTES) {
    throw new Error("That artwork file is too large to copy.");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_SPOTIFY_ARTWORK_BYTES) {
    throw new Error("That artwork file is empty or too large to copy.");
  }

  const assetId = crypto.randomUUID();
  const path = buildStoragePath({
    trackId,
    kind: "asset",
    entityId: assetId,
    filename: `spotify-cover.${extension}`,
  });
  // Upload through the signed-in user's client so Supabase records the object
  // as user-owned. Service-role uploads can be written successfully while
  // still being unreadable through the browser's private-bucket policies.
  const { error: uploadError } = await userStorage.storage
    .from("audio")
    .upload(path, bytes, { contentType, cacheControl: "31536000", upsert: false });
  if (uploadError) throw uploadError;

  const { error: assetError } = await ctx.admin.from("assets").insert({
    id: assetId,
    track_id: trackId,
    kind: "artwork",
    name: `${trackTitle} — Spotify cover`,
    file_url: path,
    file_size: bytes.byteLength,
  });
  if (assetError) {
    await ctx.admin.storage.from("audio").remove([path]);
    throw assetError;
  }

  const { error: trackError } = await ctx.admin
    .from("tracks")
    .update({ artwork_url: path, updated_at: new Date().toISOString() })
    .eq("id", trackId)
    .eq("user_id", ctx.userId);

  if (trackError) {
    await ctx.admin.from("assets").delete().eq("id", assetId);
    await ctx.admin.storage.from("audio").remove([path]);
    throw trackError;
  }
}

/**
 * POST /api/import/[id]/commit — build the workspace.
 *
 * The only route that writes to the real catalog, and only what the artist
 * ticked. The edited plan is re-validated here with the same validator used on
 * the model's output, so client-side edits get the same treatment as the AI's
 * guesses: enums coerced, dangling refs dropped, stage names checked against
 * the target space.
 *
 * Body: { plan, selection: { trackRefs, projectRefs, taskRefs } }
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await resolveImport(params.id);
  if (!ctx) {
    return NextResponse.json(
      { error: IMPORT_UNAVAILABLE_MESSAGE },
      { status: 404, headers: noStoreHeaders() },
    );
  }

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload.plan !== "object" || !payload.plan) {
    return NextResponse.json(
      { error: "Nothing to build." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  const selection = payload.selection ?? {};
  const asRefs = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

  const context = await loadWorkspaceContext(ctx.admin, ctx.userId);
  const plan = validatePlan(payload.plan, context);

  const artistId = typeof payload.artistId === "string" ? payload.artistId : "";
  const { data: artist } = await ctx.admin
    .from("artists")
    .select("id")
    .eq("id", artistId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (!artist) {
    return NextResponse.json(
      { error: "Choose an artist before building this import." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  const commitPayload = toCommitPayload(plan, {
    trackRefs: asRefs(selection.trackRefs),
    projectRefs: asRefs(selection.projectRefs),
    taskRefs: asRefs(selection.taskRefs),
  });
  commitPayload.artistId = artistId;

  const spotifyInput =
    payload.spotify && typeof payload.spotify === "object" ? payload.spotify : null;
  const spotifyArtistId = String(spotifyInput?.artistId ?? "");
  const spotifyMatches = Array.isArray(spotifyInput?.matches)
    ? spotifyInput.matches
        .filter(
          (match: unknown): match is { trackRef: string; spotifyTrackId: string } =>
            !!match &&
            typeof match === "object" &&
            typeof (match as { trackRef?: unknown }).trackRef === "string" &&
            typeof (match as { spotifyTrackId?: unknown }).spotifyTrackId === "string"
        )
        .slice(0, 500)
    : [];

  const spotifyByTrackRef = new Map<string, SpotifyCatalogTrack>();
  if (/^[A-Za-z0-9]{22}$/.test(spotifyArtistId) && spotifyMatches.length > 0) {
    // Re-read the artist catalog in pages instead of making one Spotify call
    // per released song. Only user-described tracks need the richer single-
    // track response (primarily for ISRC); generated catalog additions already
    // have everything needed for a released TEMPO entry.
    const cachedTracks = cachedSpotifyCatalog(ctx.imp.summary, spotifyArtistId);
    const catalogTracks = cachedTracks ?? (await fetchSpotifyTrackCatalog(spotifyArtistId)).tracks;
    const detailedIds = spotifyMatches
      .filter((match: { trackRef: string }) => !match.trackRef.startsWith("spotify_"))
      .map((match: { spotifyTrackId: string }) => match.spotifyTrackId);
    const detailedTracks = await fetchSpotifyTracks(detailedIds);
    const spotifyById = new Map<string, SpotifyCatalogTrack>(
      catalogTracks.map((track) => [track.id, track])
    );
    for (const track of detailedTracks) spotifyById.set(track.id, track);
    for (const match of spotifyMatches) {
      const spotifyTrack = spotifyById.get(match.spotifyTrackId);
      if (!spotifyTrack) continue;
      // A browser cannot smuggle in an unrelated track: the confirmed artist
      // must actually be credited on the fresh Spotify response.
      if (!spotifyTrack.artists.some((credit) => credit.id === spotifyArtistId)) continue;
      spotifyByTrackRef.set(match.trackRef, spotifyTrack);
    }

    for (const track of commitPayload.tracks) {
      const spotifyTrack = spotifyByTrackRef.get(track.ref);
      if (!spotifyTrack) continue;
      track.spotify = {
        trackId: spotifyTrack.id,
        trackUrl: spotifyTrack.url,
        albumId: spotifyTrack.album.id,
        albumName: spotifyTrack.album.name,
        albumUrl: spotifyTrack.album.url,
        releaseDate: spotifyTrack.album.releaseDate,
        releaseDatePrecision: spotifyTrack.album.releaseDatePrecision,
        artworkUrl: spotifyTrack.album.artworkUrl,
        isrc: spotifyTrack.isrc,
        durationMs: spotifyTrack.durationMs,
        explicit: spotifyTrack.explicit,
        trackNumber: spotifyTrack.trackNumber,
        discNumber: spotifyTrack.discNumber,
        artistNames: spotifyTrack.artists.map((credit) => credit.name),
      };
    }

    // If a described TEMPO track was matched to a released recording, prefer
    // that richer user-authored row over the generated catalog addition for
    // the same Spotify id. Unmatched catalog songs remain additive.
    const describedSpotifyIds = new Set(
      commitPayload.tracks
        .filter((track) => !track.ref.startsWith("spotify_") && track.spotify)
        .map((track) => track.spotify!.trackId)
    );
    commitPayload.tracks = commitPayload.tracks.filter(
      (track) =>
        !(
          track.ref.startsWith("spotify_") &&
          track.spotify &&
          describedSpotifyIds.has(track.spotify.trackId)
        )
    );
  }

  const nothingSelected =
    commitPayload.tracks.length === 0 &&
    commitPayload.projects.length === 0 &&
    commitPayload.tasks.length === 0;

  if (nothingSelected) {
    return NextResponse.json(
      { error: "Pick at least one thing to add." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  await setImportStatus(ctx.admin, ctx.imp.id, "committing", { error: null });

  // Through the user's own session, not the service role: the function reads
  // auth.uid() to decide whose catalog this is.
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("commit_workspace_import", {
    p_import_id: ctx.imp.id,
    p_plan: commitPayload,
  });

  if (error) {
    console.error("[import] commit failed:", error.message);
    await setImportStatus(ctx.admin, ctx.imp.id, "needs_review", {
      error: "Couldn’t build your workspace. Nothing was added — try again.",
    });
    return NextResponse.json(
      { error: "Couldn’t build your workspace. Nothing was added — try again." },
      { status: 500, headers: noStoreHeaders() },
    );
  }

  if (spotifyByTrackRef.size > 0) {
    await ctx.admin
      .from("artists")
      .update({ spotify_artist_id: spotifyArtistId })
      .eq("id", artistId)
      .eq("user_id", ctx.userId);
  }

  let metadataImported = 0;
  let metadataFailed = 0;
  let artworkImported = 0;
  let artworkFailed = 0;
  const shouldCopyArtwork = spotifyInput?.copyArtwork !== false;

  // Full Spotify enrichment (link, ISRC, duration, artwork copy) is a
  // per-track HTTP download + storage write + several DB round-trips — fine
  // for a handful of tracks, but a 500-track catalog import turns it into
  // hundreds of outbound requests. Every track already gets its basic
  // metadata (title, type, album note) from the plan itself; only the most
  // recently released tracks get the richer Spotify-backed enrichment below.
  const ENRICHMENT_CAP = 100;
  const enrichTrackRefs = new Set(
    commitPayload.tracks
      .filter((track) => track.spotify)
      .sort((a, b) =>
        (b.spotify!.releaseDate ?? "").localeCompare(a.spotify!.releaseDate ?? "")
      )
      .slice(0, ENRICHMENT_CAP)
      .map((track) => track.ref)
  );

  const trackIds =
    data && typeof data === "object" && data.trackIds && typeof data.trackIds === "object"
      ? (data.trackIds as Record<string, string>)
      : {};
  const projectIds =
    data && typeof data === "object" && data.projectIds && typeof data.projectIds === "object"
      ? (data.projectIds as Record<string, string>)
      : {};
  for (const track of commitPayload.tracks) {
    const spotify = track.spotify;
    const trackId = trackIds[track.ref];
    if (!spotify || !trackId || !enrichTrackRefs.has(track.ref)) continue;
    const { error: metadataError } = await ctx.admin
      .from("tracks")
      .update({
        spotify_track_id: spotify.trackId,
        spotify_url: spotify.trackUrl,
        spotify_album_id: spotify.albumId,
        spotify_album_name: spotify.albumName,
        spotify_album_url: spotify.albumUrl,
        spotify_release_date: spotify.releaseDate,
        spotify_release_date_precision: spotify.releaseDatePrecision,
        spotify_isrc: spotify.isrc,
        spotify_duration_ms: spotify.durationMs,
        spotify_explicit: spotify.explicit,
        spotify_track_number: spotify.trackNumber,
        spotify_disc_number: spotify.discNumber,
        spotify_artist_names: spotify.artistNames,
        spotify_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", trackId)
      .eq("user_id", ctx.userId);
    if (metadataError) {
      metadataFailed += 1;
      console.error("[import] Spotify metadata save failed:", metadataError.message);
    } else {
      metadataImported += 1;
      const projectId = track.projectRef ? projectIds[track.projectRef] : null;
      if (projectId) {
        const { error: releaseMetaError } = await ctx.admin
          .from("release_track_metadata")
          .upsert(
            {
              project_id: projectId,
              track_id: trackId,
              track_number: spotify.trackNumber,
              isrc: spotify.isrc,
              explicit: spotify.explicit,
              primary_artist: spotify.artistNames[0] ?? null,
              featured_artists: spotify.artistNames.slice(1),
            },
            { onConflict: "project_id,track_id" }
          );
        if (releaseMetaError) {
          console.error(
            "[import] release metadata mirror failed:",
            releaseMetaError.message
          );
        }
      }
    }
  }

  for (const project of commitPayload.projects) {
    const projectId = projectIds[project.ref];
    if (!projectId || !["single", "ep", "album"].includes(project.projectType)) continue;
    const matched = commitPayload.tracks.filter(
      (track) => track.projectRef === project.ref && track.spotify
    );
    if (matched.length === 0) continue;
    const albumIds = new Set(matched.map((track) => track.spotify!.albumId));
    if (albumIds.size !== 1) continue;
    const spotify = matched[0].spotify!;
    const fullDate =
      spotify.releaseDatePrecision === "day" ? spotify.releaseDate : null;
    const { error: releaseError } = await ctx.admin.from("release_details").upsert({
      project_id: projectId,
      release_date: fullDate,
      live_url: spotify.albumUrl,
      updated_at: new Date().toISOString(),
    });
    if (releaseError) {
      console.error("[import] release details mirror failed:", releaseError.message);
    }
  }

  if (shouldCopyArtwork && !data?.alreadyCommitted) {
    // A small batch keeps catalog imports fast without creating a burst of
    // outbound downloads or storage writes.
    const jobs = commitPayload.tracks.flatMap((track) => {
      if (!enrichTrackRefs.has(track.ref)) return [];
      const source = track.spotify?.artworkUrl;
      const trackId = trackIds[track.ref];
      return source && trackId ? [{ track, source, trackId }] : [];
    });
    for (let i = 0; i < jobs.length; i += 4) {
      const results = await Promise.allSettled(
        jobs.slice(i, i + 4).map((job) =>
          copySpotifyArtwork(
            ctx,
            supabase,
            job.trackId,
            job.track.title,
            job.source
          )
        )
      );
      for (const result of results) {
        if (result.status === "fulfilled") artworkImported += 1;
        else {
          artworkFailed += 1;
          console.error("[import] Spotify artwork copy failed:", result.reason);
        }
      }
    }
  }

  // The catalog is built; the raw source material has done its job.
  await deleteImportFiles(ctx.admin, ctx.imp.id);

  return NextResponse.json(
    {
      summary: {
        ...data,
        metadataImported,
        metadataFailed,
        artworkImported,
        artworkFailed,
      },
    },
    { headers: noStoreHeaders() }
  );
}
