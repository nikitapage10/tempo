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
  id?: string;
  name: string;
  imageUrl: string | null;
  url: string | null;
};

/** Cached across invocations of a warm lambda; tokens last an hour. */
let cachedToken: { value: string; expiresAt: number } | null = null;
const responseCache = new Map<string, { value: unknown; expiresAt: number }>();
const inFlightRequests = new Map<string, Promise<unknown>>();
const RESPONSE_CACHE_MS = 10 * 60 * 1000;
const REQUEST_GAP_MS = 180;
const MAX_RATE_LIMIT_RETRIES = 2;
let requestQueue: Promise<void> = Promise.resolve();
let nextRequestAt = 0;

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Serializes this lambda's Spotify calls so one catalog cannot create a burst. */
async function queuedSpotifyFetch(url: string, init: RequestInit): Promise<Response> {
  const previous = requestQueue;
  let release = () => {};
  requestQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  const delay = Math.max(0, nextRequestAt - Date.now());
  if (delay) await wait(delay);
  try {
    return await fetch(url, init);
  } finally {
    nextRequestAt = Date.now() + REQUEST_GAP_MS;
    release();
  }
}

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

async function spotifyGetUncached<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    const res = await queuedSpotifyFetch(`${API}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.status === 404) throw new Error("That Spotify artist wasn't found.");
    if (res.status === 429) {
      const retryAfter = Math.max(1, Number(res.headers.get("retry-after")) || 2);
      if (attempt < MAX_RATE_LIMIT_RETRIES) {
        await wait(Math.min(30, retryAfter) * 1000);
        continue;
      }
      throw new Error(`Spotify asked us to slow down. Try again in about ${retryAfter} seconds.`);
    }
    if (res.status === 403) {
      const detail = await res.text().catch(() => "");
      console.error("[spotify] catalog request denied", {
        path,
        status: res.status,
        detail: detail.slice(0, 500),
      });
      throw new Error(
        "Spotify denied catalog access. In Development Mode, make sure the app owner has an active Spotify Premium subscription."
      );
    }
    if (!res.ok) throw new Error(`Spotify request failed (${res.status}).`);
    return (await res.json()) as T;
  }
  throw new Error("Spotify couldn't be reached.");
}

async function spotifyGet<T>(path: string): Promise<T> {
  const cached = responseCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.value as T;
  const existing = inFlightRequests.get(path);
  if (existing) return existing as Promise<T>;

  const request = spotifyGetUncached<T>(path)
    .then((value) => {
      if (responseCache.size >= 1000) {
        const now = Date.now();
        responseCache.forEach((entry, key) => {
          if (entry.expiresAt <= now) responseCache.delete(key);
        });
        if (responseCache.size >= 1000) {
          responseCache.delete(responseCache.keys().next().value as string);
        }
      }
      responseCache.set(path, { value, expiresAt: Date.now() + RESPONSE_CACHE_MS });
      return value;
    })
    .finally(() => inFlightRequests.delete(path));
  inFlightRequests.set(path, request);
  return request;
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
    id: artistId,
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
      `/artists/${artistId}/albums?limit=10&include_groups=album,single,compilation`
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
  {
    id: string;
    name: string;
    followers: number | null;
    imageUrl: string | null;
    url: string | null;
  }[]
> {
  type SearchRes = {
    artists: {
      items: {
        id: string;
        name: string;
        followers: { total: number };
        images: { url: string }[];
        external_urls?: { spotify?: string };
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
    url: a.external_urls?.spotify ?? null,
  }));
}

export type SpotifyCatalogTrack = {
  id: string;
  title: string;
  artists: { id: string; name: string }[];
  album: {
    id: string;
    name: string;
    type: string | null;
    releaseDate: string | null;
    releaseDatePrecision: string | null;
    artworkUrl: string | null;
    url: string | null;
  };
  durationMs: number | null;
  explicit: boolean;
  isrc: string | null;
  trackNumber: number | null;
  discNumber: number | null;
  url: string | null;
};

type SpotifySimpleArtist = { id: string; name: string };
type SpotifySimpleAlbum = {
  id: string;
  name: string;
  album_type?: string;
  release_date?: string;
  release_date_precision?: string;
  images?: { url: string }[];
  external_urls?: { spotify?: string };
  artists?: SpotifySimpleArtist[];
};
type SpotifySimpleTrack = {
  id?: string;
  name: string;
  artists?: SpotifySimpleArtist[];
  duration_ms?: number;
  explicit?: boolean;
  track_number?: number;
  disc_number?: number;
  external_urls?: { spotify?: string };
};
type SpotifyFullTrack = {
  id: string;
  name: string;
  artists?: SpotifySimpleArtist[];
  album: SpotifySimpleAlbum;
  duration_ms?: number;
  explicit?: boolean;
  external_ids?: { isrc?: string };
  track_number?: number;
  disc_number?: number;
  external_urls?: { spotify?: string };
};

function asCatalogTrack(track: SpotifyFullTrack): SpotifyCatalogTrack {
  return {
    id: track.id,
    title: track.name,
    artists: track.artists ?? [],
    album: {
      id: track.album.id,
      name: track.album.name,
      type: track.album.album_type ?? null,
      releaseDate: track.album.release_date ?? null,
      releaseDatePrecision: track.album.release_date_precision ?? null,
      artworkUrl: track.album.images?.[0]?.url ?? null,
      url: track.album.external_urls?.spotify ?? null,
    },
    durationMs:
      typeof track.duration_ms === "number" ? track.duration_ms : null,
    explicit: track.explicit === true,
    isrc: track.external_ids?.isrc ?? null,
    trackNumber:
      typeof track.track_number === "number" ? track.track_number : null,
    discNumber: typeof track.disc_number === "number" ? track.disc_number : null,
    url: track.external_urls?.spotify ?? null,
  };
}

async function fetchAllArtistAlbums(artistId: string): Promise<SpotifySimpleAlbum[]> {
  type AlbumsPage = {
    items?: SpotifySimpleAlbum[];
    next?: string | null;
    total?: number;
  };

  const market = (process.env.SPOTIFY_MARKET || "US").toUpperCase();
  const albums: SpotifySimpleAlbum[] = [];
  // Since February 2026 this endpoint accepts at most ten releases per page.
  // Bound the first pass to 80 primary releases. The previous 200-release crawl
  // plus every appearance could fan out into hundreds of calls before the user
  // had even confirmed the artist.
  for (let offset = 0; offset < 80; offset += 10) {
    const page = await spotifyGet<AlbumsPage>(
      `/artists/${artistId}/albums?include_groups=album,single,compilation&market=${encodeURIComponent(market)}&limit=10&offset=${offset}`
    );
    albums.push(...(page.items ?? []));
    if (!page.next || albums.length >= (page.total ?? albums.length)) break;
  }

  const byId = new Map<string, SpotifySimpleAlbum>();
  for (const album of albums) byId.set(album.id, album);
  return Array.from(byId.values());
}

async function fetchAlbumTracks(album: SpotifySimpleAlbum): Promise<SpotifyCatalogTrack[]> {
  type TracksPage = {
    items?: SpotifySimpleTrack[];
    next?: string | null;
    total?: number;
  };
  const tracks: SpotifyCatalogTrack[] = [];
  // Ten is accepted by the restricted Development Mode endpoints. Most artist
  // releases are singles or short albums, so this is usually one request.
  for (let offset = 0; offset < 200; offset += 10) {
    const page = await spotifyGet<TracksPage>(
      `/albums/${album.id}/tracks?limit=10&offset=${offset}`
    );
    for (const track of page.items ?? []) {
      if (!track.id) continue;
      tracks.push({
        id: track.id,
        title: track.name,
        artists: track.artists ?? [],
        album: {
          id: album.id,
          name: album.name,
          type: album.album_type ?? null,
          releaseDate: album.release_date ?? null,
          releaseDatePrecision: album.release_date_precision ?? null,
          artworkUrl: album.images?.[0]?.url ?? null,
          url: album.external_urls?.spotify ?? null,
        },
        durationMs: typeof track.duration_ms === "number" ? track.duration_ms : null,
        explicit: track.explicit === true,
        isrc: null,
        trackNumber: typeof track.track_number === "number" ? track.track_number : null,
        discNumber: typeof track.disc_number === "number" ? track.disc_number : null,
        url: track.external_urls?.spotify ?? null,
      });
    }
    if (!page.next || tracks.length >= (page.total ?? tracks.length)) break;
  }
  return tracks;
}

async function inBatches<T, R>(
  values: T[],
  size: number,
  work: (value: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < values.length; i += size) {
    results.push(...(await Promise.all(values.slice(i, i + size).map(work))));
  }
  return results;
}

/**
 * Full track records, including ISRC and album artwork.
 *
 * Spotify removed the bulk `GET /tracks?ids=...` endpoint from Development
 * Mode in February 2026. Fetch the supported single-track endpoint instead,
 * keeping concurrency low enough to avoid a burst against Spotify's quota.
 */
export async function fetchSpotifyTracks(
  trackIds: string[]
): Promise<SpotifyCatalogTrack[]> {
  const ids = Array.from(
    new Set(trackIds.filter((id) => /^[A-Za-z0-9]{22}$/.test(id)))
  ).slice(0, 500);
  if (ids.length === 0) return [];
  const tracks = await inBatches(ids, 5, (id) =>
    spotifyGet<SpotifyFullTrack>(`/tracks/${encodeURIComponent(id)}`)
  );
  return tracks.map(asCatalogTrack);
}

/**
 * Builds the released track catalog behind one confirmed Spotify artist.
 * Releases and appearances are paginated; only tracks actually crediting the
 * chosen artist are retained.
 */
export async function fetchSpotifyTrackCatalog(artistId: string): Promise<{
  artist: SpotifyArtistIdentity & { id: string };
  tracks: SpotifyCatalogTrack[];
}> {
  if (!/^[A-Za-z0-9]{22}$/.test(artistId)) {
    throw new Error("That Spotify artist id isn't valid.");
  }

  const [identity, albums] = await Promise.all([
    fetchSpotifyArtist(artistId),
    fetchAllArtistAlbums(artistId),
  ]);
  const trackLists = await inBatches(albums, 4, (album) =>
    fetchAlbumTracks(album)
  );
  const byId = new Map<string, SpotifyCatalogTrack>();
  for (const track of trackLists.flat()) if (!byId.has(track.id)) byId.set(track.id, track);

  return {
    artist: { ...identity, id: artistId },
    tracks: Array.from(byId.values()).filter((track) =>
      track.artists.some((artist) => artist.id === artistId)
    ),
  };
}
