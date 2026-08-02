"use client";

import * as React from "react";
import { getSignedUrl, peekSignedUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

type SignedImageProps = {
  path: string | null | undefined;
  alt?: string;
  className?: string;
  fallback?: React.ReactNode;
};

function isAbsoluteSrc(path: string): boolean {
  return (
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
    const match = path.match(
      /^tracks\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/assets\//i
    );
    if (!match) throw error;

    const response = await fetch(`/api/tracks/${match[1]}/artwork-url`, {
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
}

/** Resolves a storage path (or absolute URL) to a signed img src. */
export function SignedImage({
  path,
  alt = "",
  className,
  fallback,
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
    <img src={src} alt={alt} className={cn("object-cover", className)} />
  );
}
