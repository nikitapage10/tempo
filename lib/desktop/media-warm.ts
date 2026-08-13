/**
 * Quietly mirrors catalog imagery into the desktop vault so the next open
 * of Tracks / Projects / Scenes / Artist doesn't re-download every cover.
 */

import { fetchArtists } from "@/lib/api/artists";
import { fetchMyScenes } from "@/lib/api/scenes";
import { fetchSpaces } from "@/lib/api/spaces";
import { fetchTrackGroups } from "@/lib/api/track-groups";
import { fetchTracks } from "@/lib/api/tracks";
import { isDesktopApp, vaultHas } from "@/lib/desktop/bridge";
import { resolveStorageImageUrl } from "@/lib/media/resolve-image-url";
import { mirrorSignedUrlToVault } from "@/lib/storage";

const MAX_PATHS_PER_PASS = 120;
const CONCURRENCY = 3;
const START_DELAY_MS = 2500;

function pushPath(out: string[], seen: Set<string>, raw: string | null | undefined) {
  if (!raw) return;
  const path = raw.trim();
  if (!path) return;
  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("/") ||
    path.startsWith("data:") ||
    path.startsWith("blob:")
  ) {
    return;
  }
  if (seen.has(path)) return;
  seen.add(path);
  out.push(path);
}

/** Collect storage paths for covers, banners, logos, and emblems. */
export async function collectDesktopMediaWarmPaths(
  activeArtistId: string | null,
  activeSpaceId: string | null
): Promise<string[]> {
  const seen = new Set<string>();
  const paths: string[] = [];

  const artists = await fetchArtists().catch(() => []);
  for (const artist of artists) {
    pushPath(paths, seen, artist.logo_url);
    pushPath(paths, seen, artist.emblem_url);
    pushPath(paths, seen, artist.banner_url);
  }

  const scenes = await fetchMyScenes().catch(() => []);
  for (const scene of scenes) {
    pushPath(paths, seen, scene.banner_url);
    pushPath(paths, seen, scene.emblem_url);
  }

  // Prefer the active artist's spaces; fall back to active space alone.
  const artistIds = activeArtistId
    ? [activeArtistId]
    : artists.map((a) => a.id).slice(0, 3);

  const spaceIds = new Set<string>();
  if (activeSpaceId) spaceIds.add(activeSpaceId);

  for (const artistId of artistIds) {
    const spaces = await fetchSpaces(artistId).catch(() => []);
    for (const space of spaces) spaceIds.add(space.id);
  }

  for (const spaceId of Array.from(spaceIds)) {
    const [tracks, groups] = await Promise.all([
      fetchTracks(spaceId).catch(() => []),
      fetchTrackGroups(spaceId).catch(() => []),
    ]);
    for (const track of tracks) pushPath(paths, seen, track.artwork_url);
    for (const group of groups) pushPath(paths, seen, group.cover_url);
    if (paths.length >= MAX_PATHS_PER_PASS) break;
  }

  return paths.slice(0, MAX_PATHS_PER_PASS);
}

async function mapPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index++];
      await worker(current);
    }
  });
  await Promise.all(runners);
}

/**
 * Resolve + mirror each path into the vault. Safe to call repeatedly —
 * vault hits are no-ops and failures are swallowed.
 */
export async function warmDesktopVaultMedia(paths: string[]): Promise<number> {
  if (!isDesktopApp() || paths.length === 0) return 0;
  let warmed = 0;

  await mapPool(paths, CONCURRENCY, async (path) => {
    try {
      if (await vaultHas(path)) {
        warmed += 1;
        return;
      }
      const url = await resolveStorageImageUrl(path);
      if (url.startsWith("tempo-local://") || (await vaultHas(path))) {
        warmed += 1;
        return;
      }
      if (url.startsWith("http://") || url.startsWith("https://")) {
        if (await mirrorSignedUrlToVault(path, url)) warmed += 1;
      }
    } catch {
      /* best-effort — UI still works against the cloud */
    }
  });

  return warmed;
}

export function scheduleDesktopMediaWarm(
  collect: () => Promise<string[]>,
  options?: { delayMs?: number; signal?: AbortSignal }
): void {
  if (!isDesktopApp()) return;
  const delay = options?.delayMs ?? START_DELAY_MS;
  const signal = options?.signal;

  const run = () => {
    if (signal?.aborted) return;
    void (async () => {
      try {
        const paths = await collect();
        if (signal?.aborted || paths.length === 0) return;
        await warmDesktopVaultMedia(paths);
      } catch (err) {
        console.warn("[desktop] media warm failed", err);
      }
    })();
  };

  if (typeof window === "undefined") return;

  const idleWindow = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof idleWindow.requestIdleCallback === "function") {
    const idle = idleWindow.setTimeout(() => {
      idleWindow.requestIdleCallback?.(run, { timeout: 4000 });
    }, delay);
    signal?.addEventListener("abort", () => idleWindow.clearTimeout(idle));
  } else {
    const t = idleWindow.setTimeout(run, delay);
    signal?.addEventListener("abort", () => idleWindow.clearTimeout(t));
  }
}
