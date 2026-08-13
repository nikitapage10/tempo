/**
 * Browser (web) media warm — batch-sign catalog covers and prefetch image
 * bytes into the HTTP cache so Tracks / Scenes / Artist feel less empty on
 * first paint. Desktop uses the vault warmer instead.
 */

import { collectDesktopMediaWarmPaths } from "@/lib/desktop/media-warm";
import { isDesktopApp } from "@/lib/desktop/bridge";
import {
  isAbsoluteMediaSrc,
  resolveStorageImageUrl,
} from "@/lib/media/resolve-image-url";
import { warmSignedUrls } from "@/lib/storage";

const CONCURRENCY = 4;
const START_DELAY_MS = 1200;
const MAX_PREFETCH = 80;

async function mapPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;
  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (index < items.length) {
        const current = items[index++];
        await worker(current);
      }
    }
  );
  await Promise.all(runners);
}

function prefetchImageBytes(url: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

/**
 * Batch-sign owner-readable paths, then resolve + Image() prefetch so the
 * next SignedImage mount often has both a URL and cached bytes ready.
 */
export async function warmBrowserMediaCache(paths: string[]): Promise<number> {
  if (isDesktopApp() || paths.length === 0 || typeof window === "undefined") {
    return 0;
  }

  const limited = paths.slice(0, MAX_PREFETCH);
  await warmSignedUrls(limited);

  let warmed = 0;
  await mapPool(limited, CONCURRENCY, async (path) => {
    try {
      if (isAbsoluteMediaSrc(path)) {
        await prefetchImageBytes(path);
        warmed += 1;
        return;
      }
      const url = await resolveStorageImageUrl(path);
      if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) {
        await prefetchImageBytes(url);
        warmed += 1;
      }
    } catch {
      /* best-effort */
    }
  });

  return warmed;
}

export function scheduleBrowserMediaWarm(
  collect: () => Promise<string[]>,
  options?: { delayMs?: number; signal?: AbortSignal }
): void {
  if (isDesktopApp() || typeof window === "undefined") return;
  const delay = options?.delayMs ?? START_DELAY_MS;
  const signal = options?.signal;

  const run = () => {
    if (signal?.aborted) return;
    void (async () => {
      try {
        const paths = await collect();
        if (signal?.aborted || paths.length === 0) return;
        await warmBrowserMediaCache(paths);
      } catch (err) {
        console.warn("[web] media warm failed", err);
      }
    })();
  };

  const idleWindow = window as Window & {
    requestIdleCallback?: (
      cb: () => void,
      opts?: { timeout: number }
    ) => number;
  };
  if (typeof idleWindow.requestIdleCallback === "function") {
    const idle = window.setTimeout(() => {
      idleWindow.requestIdleCallback?.(run, { timeout: 3000 });
    }, delay);
    signal?.addEventListener("abort", () => window.clearTimeout(idle));
  } else {
    const t = window.setTimeout(run, delay);
    signal?.addEventListener("abort", () => window.clearTimeout(t));
  }
}

/** Shared path collector used by both desktop vault warm and browser warm. */
export { collectDesktopMediaWarmPaths as collectCatalogMediaWarmPaths };
