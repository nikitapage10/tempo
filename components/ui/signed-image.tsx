"use client";

import * as React from "react";
import { getSignedUrl, peekSignedUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

type SignedImageProps = {
  path: string | null | undefined;
  alt?: string;
  className?: string;
  fallback?: React.ReactNode;
  style?: React.CSSProperties;
};

function isAbsoluteSrc(path: string): boolean {
  return (
    path.startsWith("/") ||
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("data:") ||
    path.startsWith("blob:")
  );
}

async function resolveSignedImage(path: string): Promise<string> {
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
      return body.url;
    }

    // Imagery uploaded by someone other than the viewer — storage ownership
    // gates on the uploader, so these go through a server route that re-checks
    // visibility instead: scene banners/emblems/post media, another artist's
    // emblem or profile banner, and social post attachments.
    const route = /^scenes\//.test(path)
      ? "/api/scenes/media/url"
      : /^(artists|profiles)\//.test(path)
        ? "/api/social/media/url"
        : null;
    if (route) {
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
      return body.url;
    }

    throw error;
  }
}

/** Resolves a storage path (or shared/public URL) to an img src. */
export function SignedImage({
  path,
  alt = "",
  className,
  fallback,
  style,
}: SignedImageProps) {
  // Absolute URLs are safe for SSR; storage paths resolve after mount so we
  // don't mismatch hydration with sessionStorage.
  const [src, setSrc] = React.useState<string | null>(() =>
    path && isAbsoluteSrc(path) ? path : null
  );

  React.useLayoutEffect(() => {
    let cancelled = false;
    if (!path) {
      setSrc(null);
      return;
    }
    if (isAbsoluteSrc(path)) {
      setSrc(path);
      return;
    }

    const cached = peekSignedUrl(path);
    if (cached) {
      setSrc(cached);
      return;
    }

    setSrc(null);
    resolveSignedImage(path)
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!src) return <>{fallback ?? null}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={cn("object-cover", className)} style={style} />
  );
}
