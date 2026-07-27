"use client";

import * as React from "react";
import { getSignedUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

type SignedImageProps = {
  path: string | null | undefined;
  alt?: string;
  className?: string;
  fallback?: React.ReactNode;
};

/** Resolves a storage path (or absolute URL) to a signed img src. */
export function SignedImage({
  path,
  alt = "",
  className,
  fallback,
}: SignedImageProps) {
  const [src, setSrc] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    if (!path) {
      setSrc(null);
      return;
    }
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
      setSrc(path);
      return;
    }
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
