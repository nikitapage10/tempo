import {
  cacheSignedUrl,
  getSignedUrl,
  peekSignedUrl,
} from "@/lib/storage";
import { isDesktopApp, vaultResolveUrl } from "@/lib/desktop/bridge";
import { losslessVaultSiblings } from "@/lib/audio-convert";

/** One in-flight resolve per path so grids + the warmer don't stampede. */
const resolveInflight = new Map<string, Promise<string>>();

export function isAbsoluteMediaSrc(path: string): boolean {
  return (
    path.startsWith("/") ||
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("data:") ||
    path.startsWith("blob:") ||
    path.startsWith("tempo-local://")
  );
}

/** Scene / social art usually isn't client-signable (RLS) — go straight to proxy. */
export function proxyRouteForStoragePath(path: string): string | null {
  if (/^scenes\//.test(path)) return "/api/scenes/media/url";
  if (/^(artists|profiles|members)\//.test(path)) return "/api/social/media/url";
  return null;
}

async function fetchProxySignedUrl(
  route: string,
  path: string
): Promise<string> {
  const response = await fetch(route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as
    | { url?: string; error?: string }
    | null;
  if (!response.ok || !body?.url) {
    throw new Error(body?.error || "Could not open this image.");
  }
  cacheSignedUrl(path, body.url);
  return body.url;
}

/**
 * Resolve a storage path to a playable/displayable URL. On desktop, prefers
 * the local vault (tempo-local://) over a cached HTTPS signed URL so covers
 * and scene art stay fast after the first warm.
 */
export async function resolveStorageImageUrl(path: string): Promise<string> {
  if (!path) throw new Error("Missing media path.");
  if (isAbsoluteMediaSrc(path)) return path;

  if (isDesktopApp()) {
    for (const candidate of [...losslessVaultSiblings(path), path]) {
      const local = await vaultResolveUrl(candidate);
      if (local) return local;
    }
  }

  const cached = peekSignedUrl(path);
  if (cached && !isDesktopApp()) return cached;
  // On desktop, still try getSignedUrl so a vault miss can fall through to
  // signing + background mirror — even when sessionStorage already has HTTPS.

  const inflight = resolveInflight.get(path);
  if (inflight) return inflight;

  const request = (async () => {
    const proxy = proxyRouteForStoragePath(path);
    if (proxy) {
      try {
        return await fetchProxySignedUrl(proxy, path);
      } catch {
        /* fall through to client sign / track artwork helpers */
      }
    }

    try {
      return await getSignedUrl(path);
    } catch (error) {
      const trackMatch = path.match(
        /^tracks\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/assets\//i
      );
      if (trackMatch) {
        const response = await fetch(`/api/tracks/${trackMatch[1]}/artwork-url`, {
          cache: "no-store",
        });
        const body = (await response.json().catch(() => null)) as
          | { url?: string; error?: string }
          | null;
        if (!response.ok || !body?.url) {
          throw new Error(body?.error || "Could not create a cover link.");
        }
        cacheSignedUrl(path, body.url);
        return body.url;
      }

      if (proxy) {
        // Already tried; rethrow original client-sign failure.
        throw error;
      }

      throw error;
    }
  })();

  resolveInflight.set(path, request);
  try {
    return await request;
  } finally {
    resolveInflight.delete(path);
  }
}
