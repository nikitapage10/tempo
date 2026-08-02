import { NextResponse, type NextRequest } from "next/server";
import {
  IMPORT_UNAVAILABLE_MESSAGE,
  noStoreHeaders,
  resolveImport,
} from "@/lib/import-server";
import {
  fetchSpotifyTrackCatalog,
  searchSpotifyArtists,
} from "@/lib/platforms/spotify";
import { matchSpotifyCatalog } from "@/lib/spotify-import-match";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function fail(message: string, status = 400) {
  return NextResponse.json(
    { error: message },
    { status, headers: noStoreHeaders() }
  );
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
      if (tracks.length === 0) return fail("There aren't any tracks to match.");

      const catalog = await fetchSpotifyTrackCatalog(artistId);
      return NextResponse.json(
        {
          artist: catalog.artist,
          catalogTrackCount: catalog.tracks.length,
          matches: matchSpotifyCatalog(tracks, catalog.tracks),
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
