import "server-only";

/**
 * SoundCloud API, client-credentials flow.
 *
 * Registering an app needs a SoundCloud Artist Pro subscription, but the data
 * read here is public — the same play/like/repost counts anyone sees on the
 * profile — so no user authorization flow is needed.
 *
 * The API returns current cumulative counters only. It does not expose the
 * Insights dashboard: no plays-over-time, no geography, no demographics.
 * TEMPO builds the trend itself by snapshotting these totals daily.
 */

const TOKEN_URL = "https://secure.soundcloud.com/oauth/token";
const API = "https://api.soundcloud.com";

export type SoundCloudTrackStat = {
  id: number;
  title: string;
  plays: number;
  likes: number;
  reposts: number;
  comments: number;
};

export type SoundCloudArtistStats = {
  username: string;
  followers: number;
  trackCount: number;
  avatarUrl: string | null;
  plays: number;
  likes: number;
  reposts: number;
  tracks: SoundCloudTrackStat[];
};

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const id = process.env.SOUNDCLOUD_CLIENT_ID;
  const secret = process.env.SOUNDCLOUD_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error(
      "SoundCloud isn't configured — SOUNDCLOUD_CLIENT_ID and SOUNDCLOUD_CLIENT_SECRET are missing."
    );
  }

  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  // secure.soundcloud.com requires the credentials as HTTP Basic auth —
  // passing them as body params there is rejected with `invalid_client`,
  // even though the legacy api.soundcloud.com/oauth2/token host accepts them.
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json; charset=utf-8",
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `SoundCloud rejected the credentials (${res.status}). Check the client ID and secret, and that the app is on an Artist Pro account.`
    );
  }

  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

async function scGet<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `OAuth ${token}`,
      Accept: "application/json; charset=utf-8",
    },
    cache: "no-store",
  });
  if (res.status === 404) throw new Error("That SoundCloud profile wasn't found.");
  if (res.status === 429) {
    throw new Error("SoundCloud is rate-limiting us — try again later.");
  }
  if (!res.ok) throw new Error(`SoundCloud request failed (${res.status}).`);
  return (await res.json()) as T;
}

/**
 * Resolve a profile URL to a numeric user id.
 *
 * SoundCloud ids aren't visible in the UI, so linking takes the profile URL
 * the artist actually knows and resolves it here.
 */
export async function resolveSoundCloudUser(
  profileUrl: string
): Promise<{ id: number; username: string }> {
  const url = profileUrl.trim();
  if (!/^https?:\/\/(www\.)?soundcloud\.com\/[^/\s]+/i.test(url)) {
    throw new Error(
      "That doesn't look like a SoundCloud profile URL (https://soundcloud.com/yourname)."
    );
  }
  // /resolve answers with a 302-shaped body rather than the user object:
  //   {"status":"302 - Found","location":"https://api.soundcloud.com/users/soundcloud:users:130864304"}
  // The id is the last colon-separated segment of that URN.
  const json = await scGet<{
    status?: string;
    location?: string;
    id?: number;
    username?: string;
  }>(`/resolve?url=${encodeURIComponent(url)}`);

  if (json?.id && json.username) {
    return { id: json.id, username: json.username };
  }

  const urn = json?.location?.match(/users\/(?:soundcloud:users:)?(\d+)/);
  if (!urn) {
    throw new Error(
      "Couldn't resolve that SoundCloud profile — check the URL points at a user page."
    );
  }

  const id = Number(urn[1]);
  const user = await scGet<{ username: string }>(`/users/${id}`);
  return { id, username: user.username };
}

export async function fetchSoundCloudArtist(
  userId: string
): Promise<SoundCloudArtistStats> {
  type UserRes = {
    username: string;
    followers_count: number;
    track_count: number;
    avatar_url: string | null;
  };
  type TrackRes = {
    id: number;
    title: string;
    playback_count: number | null;
    likes_count: number | null;
    favoritings_count: number | null;
    reposts_count: number | null;
    comment_count: number | null;
  };

  // `access` has to be spelled out or the API silently drops preview/blocked
  // tracks — without it this profile returned 27 of its 32 tracks, which would
  // quietly understate the catalog.
  const trackQuery =
    "?limit=200&linked_partitioning=false&access=playable,preview,blocked";

  const [user, tracks] = await Promise.all([
    scGet<UserRes>(`/users/${userId}`),
    scGet<TrackRes[] | { collection: TrackRes[] }>(
      `/users/${userId}/tracks${trackQuery}`
    ).catch(() => [] as TrackRes[]),
  ]);

  const trackRows: TrackRes[] = Array.isArray(tracks)
    ? tracks
    : (tracks?.collection ?? []);

  const mapped: SoundCloudTrackStat[] = trackRows.map((t) => ({
    id: t.id,
    title: t.title,
    plays: t.playback_count ?? 0,
    // The API has used both names for likes over its life; take whichever came.
    likes: t.likes_count ?? t.favoritings_count ?? 0,
    reposts: t.reposts_count ?? 0,
    comments: t.comment_count ?? 0,
  }));

  const sum = (pick: (t: SoundCloudTrackStat) => number) =>
    mapped.reduce((total, t) => total + pick(t), 0);

  return {
    username: user.username,
    followers: user.followers_count ?? 0,
    trackCount: user.track_count ?? mapped.length,
    avatarUrl: user.avatar_url ?? null,
    plays: sum((t) => t.plays),
    likes: sum((t) => t.likes),
    reposts: sum((t) => t.reposts),
    tracks: mapped.sort((a, b) => b.plays - a.plays).slice(0, 10),
  };
}
