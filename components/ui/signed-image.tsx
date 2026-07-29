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
    getSignedUrl(path)
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
