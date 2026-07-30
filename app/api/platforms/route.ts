import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  fetchSpotifyArtist,
  searchSpotifyArtists,
  parseSpotifyArtistId,
} from "@/lib/platforms/spotify";
import {
  fetchSoundCloudArtist,
  resolveSoundCloudUser,
} from "@/lib/platforms/soundcloud";
import { fetchAppleCatalog, searchAppleArtists } from "@/lib/platforms/apple";

export const dynamic = "force-dynamic";

function noStore(): HeadersInit {
  return { "Cache-Control": "no-store" };
}

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: noStore() });
}

/**
 * POST /api/platforms — read public platform data and record a snapshot.
 *
 * Everything here runs server-side because the platform client secrets must
 * never reach the browser. The caller's own Supabase session is used (not the
 * service role): a user may only touch artists they own, which RLS enforces.
 *
 * Actions:
 *   search   { platform, query }            → candidates for linking
 *   resolve  { platform, input }            → turn a URL/id into a platform id
 *   refresh  { artistId, platform }         → fetch + upsert today's snapshot
 *   catalog  { artistId }                   → Apple catalog (no snapshot; no stats exist)
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.action !== "string") {
    return fail("Invalid request.");
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.", 401);

  try {
    switch (body.action) {
      case "search": {
        const query = String(body.query ?? "").trim();
        if (!query) return fail("Enter something to search for.");
        if (body.platform === "spotify") {
          return NextResponse.json(
            { results: await searchSpotifyArtists(query) },
            { headers: noStore() }
          );
        }
        if (body.platform === "apple") {
          return NextResponse.json(
            { results: await searchAppleArtists(query) },
            { headers: noStore() }
          );
        }
        return fail("SoundCloud links are resolved from a profile URL.");
      }

      case "resolve": {
        const input = String(body.input ?? "").trim();
        if (body.platform === "spotify") {
          const id = parseSpotifyArtistId(input);
          if (!id) return fail("That isn't a Spotify artist link or id.");
          const stats = await fetchSpotifyArtist(id);
          return NextResponse.json(
            { id, name: stats.name },
            { headers: noStore() }
          );
        }
        if (body.platform === "soundcloud") {
          const resolved = await resolveSoundCloudUser(input);
          return NextResponse.json(
            { id: String(resolved.id), name: resolved.username },
            { headers: noStore() }
          );
        }
        return fail("Unknown platform.");
      }

      case "refresh": {
        const artistId = String(body.artistId ?? "");
        const platform = String(body.platform ?? "");
        if (!artistId) return fail("Missing artist.");
        if (platform !== "spotify" && platform !== "soundcloud") {
          return fail("Only Spotify and SoundCloud expose numbers to track.");
        }

        // RLS scopes this to the caller's own artists.
        const { data: artist, error } = await supabase
          .from("artists")
          .select("id, spotify_artist_id, soundcloud_user_id")
          .eq("id", artistId)
          .maybeSingle();
        if (error) throw error;
        if (!artist) return fail("Artist not found.", 404);

        const linkedId =
          platform === "spotify"
            ? artist.spotify_artist_id
            : artist.soundcloud_user_id;
        if (!linkedId) {
          return fail(`This artist isn't linked to ${platform} yet.`);
        }

        const snapshot =
          platform === "spotify"
            ? await (async () => {
                const s = await fetchSpotifyArtist(linkedId);
                return {
                  followers: s.followers,
                  popularity: s.popularity,
                  plays: null,
                  likes: null,
                  reposts: null,
                  track_count: null,
                  detail: {
                    name: s.name,
                    genres: s.genres,
                    imageUrl: s.imageUrl,
                    topTracks: s.topTracks,
                  },
                };
              })()
            : await (async () => {
                const s = await fetchSoundCloudArtist(linkedId);
                return {
                  followers: s.followers,
                  popularity: null,
                  plays: s.plays,
                  likes: s.likes,
                  reposts: s.reposts,
                  track_count: s.trackCount,
                  detail: {
                    name: s.username,
                    avatarUrl: s.avatarUrl,
                    tracks: s.tracks,
                  },
                };
              })();

        // One row per artist/platform/day — a second refresh today overwrites
        // rather than double-counting.
        const { data: saved, error: saveError } = await supabase
          .from("platform_snapshots")
          .upsert(
            {
              artist_id: artistId,
              platform,
              captured_on: new Date().toISOString().slice(0, 10),
              captured_at: new Date().toISOString(),
              ...snapshot,
            },
            { onConflict: "artist_id,platform,captured_on" }
          )
          .select()
          .single();
        if (saveError) throw saveError;

        return NextResponse.json({ snapshot: saved }, { headers: noStore() });
      }

      case "catalog": {
        const artistId = String(body.artistId ?? "");
        const { data: artist, error } = await supabase
          .from("artists")
          .select("id, apple_artist_id")
          .eq("id", artistId)
          .maybeSingle();
        if (error) throw error;
        if (!artist?.apple_artist_id) {
          return fail("This artist isn't linked to Apple yet.");
        }
        return NextResponse.json(
          { catalog: await fetchAppleCatalog(artist.apple_artist_id) },
          { headers: noStore() }
        );
      }

      default:
        return fail("Unknown action.");
    }
  } catch (err) {
    // Platform errors are already written for a musician to read.
    const message =
      err instanceof Error ? err.message : "That platform request failed.";
    return fail(message, 502);
  }
}
