"use client";

import * as React from "react";
import { useActiveArtist } from "@/components/active-artist-provider";
import { getSignedUrl, peekSignedUrl } from "@/lib/storage";

const FAVICON_ID = "tempo-artist-favicon";

function setFaviconHref(href: string | null) {
  const existing = document.getElementById(
    FAVICON_ID
  ) as HTMLLinkElement | null;

  if (!href) {
    existing?.remove();
    return;
  }

  const link = existing ?? document.createElement("link");
  link.id = FAVICON_ID;
  link.rel = "icon";
  link.href = href;
  // Browsers use the first <link rel="icon">, and Next's static
  // metadata icon already sits in <head> — this has to lead it, not
  // just be appended after.
  if (!existing) document.head.prepend(link);
}

/**
 * Swaps the browser tab's favicon to the active artist's emblem, so which
 * artist you're in reads at a glance across tabs. Falls back to TEMPO's own
 * icon (app/icon.tsx) when the artist has no emblem uploaded.
 */
export function ArtistFavicon() {
  const { activeArtist } = useActiveArtist();
  const emblemUrl = activeArtist?.emblem_url ?? null;

  React.useEffect(() => {
    if (!emblemUrl) {
      setFaviconHref(null);
      return;
    }

    if (
      emblemUrl.startsWith("http://") ||
      emblemUrl.startsWith("https://") ||
      emblemUrl.startsWith("data:")
    ) {
      setFaviconHref(emblemUrl);
      return;
    }

    let cancelled = false;
    const cached = peekSignedUrl(emblemUrl);
    if (cached) {
      setFaviconHref(cached);
    }

    getSignedUrl(emblemUrl)
      .then((url) => {
        if (!cancelled) setFaviconHref(url);
      })
      .catch(() => {
        /* keep whatever favicon is already showing */
      });

    return () => {
      cancelled = true;
    };
  }, [emblemUrl]);

  return null;
}
