import { NextResponse, type NextRequest } from "next/server";
import {
  IMPORT_UNAVAILABLE_MESSAGE,
  noStoreHeaders,
  resolveImport,
} from "@/lib/import-server";
import {
  fetchSpotifyTrackCatalog,
  parseSpotifyArtistId,
  searchSpotifyArtists,
} from "@/lib/platforms/spotify";
import { matchSpotifyCatalog } from "@/lib/spotify-import-match";
import { buildSpotifyCatalogImport } from "@/lib/spotify-import-plan";
import type { SpotifyCatalogTrack, SpotifyArtistIdentity } from "@/lib/platforms/spotify";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function fail(message: string, status = 400) {
  return NextResponse.json(
    { error: message },
    { status, headers: noStoreHeaders() }
  );
}

async function cacheSpotifyCatalog(
  ctx: NonNullable<Awaited<ReturnType<typeof resolveImport>>>,
  artist: SpotifyArtistIdentity & { id: string },
  tracks: SpotifyCatalogTrack[],
) {
  const summary = ctx.imp.summary ?? {};
  const { error } = await ctx.admin
    .from("onboarding_imports")
    .update({
      summary: {
        ...summary,
        spotifyCatalog: {
          artist,
          tracks,
          cachedAt: new Date().toISOString(),
        },
      },
    })
    .eq("id", ctx.imp.id)
    .eq("user_id", ctx.userId);
  if (error) throw error;
}

/** Spotify discovery for one in-progress import. No catalog state is written. */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await resolveImport(params.id);
  if (!ctx) return fail(IMPORT_UNAVAILABLE_MESSAGE, 404);

  const body = await req.json().catch(() => null);
  if (!body || typeof body.action !== "string") return fail("Invalid request.");

  try {
    if (body.action === "bootstrap") {
      const { data: sources, error: sourceError } = await ctx.admin
        .from("onboarding_sources")
        .select("id, extracted_text")
        .eq("import_id", ctx.imp.id)
        .eq("status", "ready")
        .order("sort");
      if (sourceError) throw sourceError;

      const spotifySource = (sources ?? []).find((source) =>
        parseSpotifyArtistId(String(source.extracted_text ?? ""))
      );
      const artistId = spotifySource
        ? parseSpotifyArtistId(String(spotifySource.extracted_text ?? ""))
        : null;
      if (!spotifySource || !artistId) {
        return NextResponse.json({ found: false }, { headers: noStoreHeaders() });
      }

      const spaceId = String(body.spaceId ?? "");
      const tempoArtistId = String(body.artistId ?? "");
      const { data: space, error: spaceError } = await ctx.admin
        .from("spaces")
        .select("id, name, focus")
        .eq("id", spaceId)
        .eq("artist_id", tempoArtistId)
        .eq("user_id", ctx.userId)
        .maybeSingle();
      if (spaceError) throw spaceError;
      if (!space || space.focus !== "music") {
        return fail("Choose a music space before importing Spotify.");
      }

      const [catalog, stagesResult, tracksResult] = await Promise.all([
        fetchSpotifyTrackCatalog(artistId),
        ctx.admin
          .from("stages")
          .select("name")
          .eq("space_id", space.id)
          .order("sort"),
        ctx.admin.from("tracks").select("title").eq("user_id", ctx.userId).limit(1000),
      ]);
      if (stagesResult.error) throw stagesResult.error;
      if (tracksResult.error) throw tracksResult.error;
      await cacheSpotifyCatalog(ctx, catalog.artist, catalog.tracks);

      const built = buildSpotifyCatalogImport({
        artist: catalog.artist,
        catalog: catalog.tracks,
        sourceId: spotifySource.id,
        space: {
          id: space.id,
          name: space.name,
          stageNames: (stagesResult.data ?? []).map((stage) => stage.name),
        },
        existingTracks: tracksResult.data ?? [],
      });
      return NextResponse.json(
        { found: true, ...built },
        { headers: noStoreHeaders() }
      );
    }

    if (body.action === "search") {
      const query = String(body.query ?? "").trim().slice(0, 120);
      if (!query) return fail("Enter an artist name.");
      const results = await searchSpotifyArtists(query);
      return NextResponse.json({ results }, { headers: noStoreHeaders() });
    }

    if (body.action === "match") {
      const artistId = String(body.artistId ?? "").trim();
      if (!/^[A-Za-z0-9]{22}$/.test(artistId)) {
        return fail("Choose a Spotify artist first.");
      }
      const tracks = Array.isArray(body.tracks)
        ? body.tracks
            .filter(
              (track: unknown): track is { ref: string; title: string } =>
                !!track &&
                typeof track === "object" &&
                typeof (track as { ref?: unknown }).ref === "string" &&
                typeof (track as { title?: unknown }).title === "string"
            )
            .slice(0, 500)
            .map((track: { ref: string; title: string }) => ({
              ref: track.ref.slice(0, 100),
              title: track.title.trim().slice(0, 300),
            }))
        : [];
      const spaceId = String(body.spaceId ?? "");
      const tempoArtistId = String(body.tempoArtistId ?? "");
      const { data: space, error: spaceError } = await ctx.admin
        .from("spaces")
        .select("id, name, focus")
        .eq("id", spaceId)
        .eq("artist_id", tempoArtistId)
        .eq("user_id", ctx.userId)
        .maybeSingle();
      if (spaceError) throw spaceError;
      if (!space || space.focus !== "music") {
        return fail("Choose a music space before importing Spotify.");
      }

      const [catalog, stagesResult, tracksResult] = await Promise.all([
        fetchSpotifyTrackCatalog(artistId),
        ctx.admin.from("stages").select("name").eq("space_id", space.id).order("sort"),
        ctx.admin.from("tracks").select("title").eq("user_id", ctx.userId).limit(1000),
      ]);
      if (stagesResult.error) throw stagesResult.error;
      if (tracksResult.error) throw tracksResult.error;
      await cacheSpotifyCatalog(ctx, catalog.artist, catalog.tracks);

      const built = buildSpotifyCatalogImport({
        artist: catalog.artist,
        catalog: catalog.tracks,
        sourceId: null,
        space: {
          id: space.id,
          name: space.name,
          stageNames: (stagesResult.data ?? []).map((stage) => stage.name),
        },
        existingTracks: tracksResult.data ?? [],
      });
      return NextResponse.json(
        {
          plan: built.plan,
          preview: {
            ...built.preview,
            matches: [
              ...matchSpotifyCatalog(tracks, catalog.tracks),
              ...built.preview.matches,
            ],
          },
        },
        { headers: noStoreHeaders() }
      );
    }

    return fail("Unknown action.");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Spotify couldn't be reached.";
    return fail(message, 502);
  }
}
