"use client";

import * as React from "react";
import {
  isAbsoluteMediaSrc,
  resolveStorageImageUrl,
} from "@/lib/media/resolve-image-url";
import { peekSignedUrl } from "@/lib/storage";
import { isDesktopApp } from "@/lib/desktop/bridge";
import { cn } from "@/lib/utils";

type SignedImageProps = {
  path: string | null | undefined;
  alt?: string;
  className?: string;
  fallback?: React.ReactNode;
  style?: React.CSSProperties;
};

/** Resolves a storage path (or shared/public URL) to an img src. */
export function SignedImage({
  path,
  alt = "",
  className,
  fallback,
  style,
}: SignedImageProps) {
  // Absolute URLs are safe for SSR; storage paths resolve after mount so we
  // don't mismatch hydration with sessionStorage. On desktop, skip the
  // session peek as the initial src — the vault may already have a faster
  // local copy that peek wouldn't know about.
  const [src, setSrc] = React.useState<string | null>(() => {
    if (!path) return null;
    if (isAbsoluteMediaSrc(path)) return path;
    if (typeof window !== "undefined" && isDesktopApp()) return null;
    return peekSignedUrl(path);
  });

  React.useLayoutEffect(() => {
    let cancelled = false;
    if (!path) {
      setSrc(null);
      return;
    }
    if (isAbsoluteMediaSrc(path)) {
      setSrc(path);
      return;
    }

    if (!isDesktopApp()) {
      const cached = peekSignedUrl(path);
      if (cached) {
        setSrc(cached);
        return;
      }
    }

    resolveStorageImageUrl(path)
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
    <img
      src={src}
      alt={alt}
      decoding="async"
      className={cn("object-cover", className)}
      style={style}
    />
  );
}
