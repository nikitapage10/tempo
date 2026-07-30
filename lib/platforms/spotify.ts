import "server-only";

/**
 * Spotify Web API, Client Credentials flow.
 *
 * Free, but catalog only. Spotify's February 2026 changes removed `followers`
 * and `popularity` from the Artist object and deleted the top-tracks endpoint
 * outright, so an app can no longer read any metric about an artist — verified
 * against the live API: /artists/{id} returns 200 carrying only identity and
 * images, and /artists/{id}/top-tracks returns 403. Stream counts and monthly
 * listeners were never available to apps either; they live only in Spotify for
 * Artists. Nothing here estimates any of it.
 *
 * Client Credentials has no user context, so this only ever reads public
 * data about an artist the user has explicitly linked.
 */

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API = "https://api.spotify.com/v1";

/**
 * Identity only — used to confirm a link and show the artist's name.
 * There are no metrics left to return; see the note at the top of this file.
 */
export type SpotifyArtistIdentity = {
  name: string;
  imageUrl: string | null;
  url: string | null;
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
): Promise<SpotifyArtistIdentity> {
  const artist = await spotifyGet<{
    name: string;
    images?: { url: string }[];
    external_urls?: { spotify?: string };
  }>(`/artists/${artistId}`);

  return {
    name: artist.name,
    imageUrl: artist.images?.[0]?.url ?? null,
    url: artist.external_urls?.spotify ?? null,
  };
}

export type SpotifyRelease = {
  id: string;
  name: string;
  releaseDate: string | null;
  albumType: string | null;
  trackCount: number | null;
  artworkUrl: string | null;
  url: string | null;
};

/**
 * The artist's releases as Spotify lists them.
 *
 * This is all Spotify still offers about an artist: `/artists/{id}/albums`
 * survived the February 2026 removals, while `followers`, `popularity` and
 * top-tracks did not. Catalog, not analytics.
 */
export async function fetchSpotifyCatalog(artistId: string): Promise<{
  name: string;
  url: string | null;
  releases: SpotifyRelease[];
}> {
  type ArtistRes = {
    name: string;
    external_urls?: { spotify?: string };
  };
  type AlbumsRes = {
    items: {
      id: string;
      name: string;
      release_date?: string;
      album_type?: string;
      total_tracks?: number;
      images?: { url: string }[];
      external_urls?: { spotify?: string };
    }[];
  };

  const [artist, albums] = await Promise.all([
    spotifyGet<ArtistRes>(`/artists/${artistId}`),
    spotifyGet<AlbumsRes>(
      `/artists/${artistId}/albums?limit=50&include_groups=album,single,compilation`
    ).catch(() => ({ items: [] }) as AlbumsRes),
  ]);

  // Spotify lists the same release once per market; collapse by name + date.
  const seen = new Set<string>();
  const releases: SpotifyRelease[] = [];
  for (const a of albums.items ?? []) {
    const key = `${a.name}|${a.release_date ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    releases.push({
      id: a.id,
      name: a.name,
      releaseDate: a.release_date ?? null,
      albumType: a.album_type ?? null,
      trackCount: a.total_tracks ?? null,
      artworkUrl: a.images?.[0]?.url ?? null,
      url: a.external_urls?.spotify ?? null,
    });
  }

  return {
    name: artist.name,
    url: artist.external_urls?.spotify ?? null,
    releases: releases.sort((a, b) =>
      (b.releaseDate ?? "").localeCompare(a.releaseDate ?? "")
    ),
  };
}

/** Name search, so linking doesn't require the user to find an id by hand. */
export async function searchSpotifyArtists(
  query: string
): Promise<
  { id: string; name: string; followers: number | null; imageUrl: string | null }[]
> {
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
  // Search items carry even less than the artist object — no followers field
  // at all — so the picker shows name and artwork only.
  return (json.artists?.items ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    followers: a.followers?.total ?? null,
    imageUrl: a.images?.[0]?.url ?? null,
  }));
}
