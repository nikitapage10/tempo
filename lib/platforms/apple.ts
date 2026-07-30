import "server-only";

/**
 * Apple, via the free iTunes Search API.
 *
 * The real Apple Music API (MusicKit) needs a signed developer token, which
 * needs a paid Apple Developer Program membership, so it is deliberately not
 * used here. iTunes Search is unauthenticated and free, but it is a *catalog*
 * endpoint: releases, dates, artwork, genre. It carries no follower counts,
 * no plays and no chart position, so there is nothing to snapshot — this
 * module shows how your discography appears on Apple, and says so plainly
 * rather than implying it is analytics.
 */

const SEARCH = "https://itunes.apple.com/search";
const LOOKUP = "https://itunes.apple.com/lookup";

export type AppleRelease = {
  id: number;
  name: string;
  releaseDate: string | null;
  trackCount: number | null;
  artworkUrl: string | null;
  genre: string | null;
  url: string | null;
};

export type AppleArtistCatalog = {
  artistId: number;
  name: string;
  url: string | null;
  releases: AppleRelease[];
};

async function itunesGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Apple lookup failed (${res.status}).`);
  // iTunes returns text/javascript, so json() can reject — parse the text.
  const text = await res.text();
  return JSON.parse(text) as T;
}

/** Bigger artwork than the default 100x100 the API hands back. */
function upscaleArtwork(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace(/\/\d+x\d+bb\.(jpg|png)$/, "/300x300bb.$1");
}

export async function searchAppleArtists(
  query: string
): Promise<{ id: number; name: string; genre: string | null }[]> {
  type Res = {
    results: { artistId: number; artistName: string; primaryGenreName?: string }[];
  };
  const json = await itunesGet<Res>(
    `${SEARCH}?term=${encodeURIComponent(query)}&entity=musicArtist&limit=8`
  );
  return (json.results ?? []).map((r) => ({
    id: r.artistId,
    name: r.artistName,
    genre: r.primaryGenreName ?? null,
  }));
}

export async function fetchAppleCatalog(
  artistId: string
): Promise<AppleArtistCatalog> {
  type Res = {
    results: {
      wrapperType: string;
      artistId: number;
      artistName?: string;
      artistLinkUrl?: string;
      collectionId?: number;
      collectionName?: string;
      releaseDate?: string;
      trackCount?: number;
      artworkUrl100?: string;
      primaryGenreName?: string;
      collectionViewUrl?: string;
    }[];
  };

  const json = await itunesGet<Res>(
    `${LOOKUP}?id=${encodeURIComponent(artistId)}&entity=album&limit=50`
  );
  const results = json.results ?? [];
  const artist = results.find((r) => r.wrapperType === "artist");
  const albums = results.filter((r) => r.wrapperType === "collection");

  return {
    artistId: Number(artistId),
    name: artist?.artistName ?? "",
    url: artist?.artistLinkUrl ?? null,
    releases: albums
      .map((a) => ({
        id: a.collectionId ?? 0,
        name: a.collectionName ?? "Untitled",
        releaseDate: a.releaseDate ? a.releaseDate.slice(0, 10) : null,
        trackCount: a.trackCount ?? null,
        artworkUrl: upscaleArtwork(a.artworkUrl100),
        genre: a.primaryGenreName ?? null,
        url: a.collectionViewUrl ?? null,
      }))
      .sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? "")),
  };
}
