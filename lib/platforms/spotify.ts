import "server-only";

/**
 * Spotify Web API, Client Credentials flow.
 *
 * Free tier. Gives followers, Spotify's own 0-100 popularity score, and the
 * artist's catalog. It does NOT give stream counts or monthly listeners —
 * those live only in Spotify for Artists, which has no public API. Nothing
 * here estimates them.
 *
 * Client Credentials has no user context, so this only ever reads public
 * data about an artist the user has explicitly linked.
 */

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API = "https://api.spotify.com/v1";

export type SpotifyArtistStats = {
  name: string;
  followers: number;
  popularity: number;
  genres: string[];
  imageUrl: string | null;
  topTracks: { name: string; popularity: number; albumName: string | null }[];
};

/** Cached across invocations of a warm lambda; tokens last an hour. */
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error(
      "Spotify isn't configured — SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET are missing."
    );
  }

  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `Spotify rejected the credentials (${res.status}). Check the client ID and secret.`
    );
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cachedToken.value;
}

async function spotifyGet<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 404) throw new Error("That Spotify artist wasn't found.");
  if (res.status === 429) {
    throw new Error("Spotify is rate-limiting us — try again in a minute.");
  }
  if (!res.ok) throw new Error(`Spotify request failed (${res.status}).`);
  return (await res.json()) as T;
}

/** Accepts a bare id, an open.spotify.com URL, or a spotify:artist: URI. */
export function parseSpotifyArtistId(input: string): string | null {
  const value = input.trim();
  if (/^[A-Za-z0-9]{22}$/.test(value)) return value;

  const uri = value.match(/^spotify:artist:([A-Za-z0-9]{22})$/);
  if (uri) return uri[1];

  const url = value.match(
    /open\.spotify\.com\/(?:intl-[a-z-]+\/)?artist\/([A-Za-z0-9]{22})/
  );
  if (url) return url[1];

  return null;
}

export async function fetchSpotifyArtist(
  artistId: string
): Promise<SpotifyArtistStats> {
  type ArtistRes = {
    name: string;
    followers: { total: number };
    popularity: number;
    genres: string[];
    images: { url: string }[];
  };
  type TopTracksRes = {
    tracks: { name: string; popularity: number; album: { name: string } | null }[];
  };

  const [artist, top] = await Promise.all([
    spotifyGet<ArtistRes>(`/artists/${artistId}`),
    // Market is required; US is the conventional default for a global read.
    spotifyGet<TopTracksRes>(`/artists/${artistId}/top-tracks?market=US`).catch(
      () => ({ tracks: [] }) as TopTracksRes
    ),
  ]);

  return {
    name: artist.name,
    followers: artist.followers?.total ?? 0,
    popularity: artist.popularity ?? 0,
    genres: artist.genres ?? [],
    imageUrl: artist.images?.[0]?.url ?? null,
    topTracks: (top.tracks ?? []).slice(0, 5).map((t) => ({
      name: t.name,
      popularity: t.popularity,
      albumName: t.album?.name ?? null,
    })),
  };
}

/** Name search, so linking doesn't require the user to find an id by hand. */
export async function searchSpotifyArtists(
  query: string
): Promise<{ id: string; name: string; followers: number; imageUrl: string | null }[]> {
  type SearchRes = {
    artists: {
      items: {
        id: string;
        name: string;
        followers: { total: number };
        images: { url: string }[];
      }[];
    };
  };
  const json = await spotifyGet<SearchRes>(
    `/search?type=artist&limit=8&q=${encodeURIComponent(query)}`
  );
  return (json.artists?.items ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    followers: a.followers?.total ?? 0,
    imageUrl: a.images?.[0]?.url ?? null,
  }));
}
