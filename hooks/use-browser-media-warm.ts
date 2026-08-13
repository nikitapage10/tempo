"use client";

import * as React from "react";
import { useActiveArtist } from "@/components/active-artist-provider";
import { useActiveSpace } from "@/components/active-space-provider";
import { isDesktopApp } from "@/lib/desktop/bridge";
import {
  collectCatalogMediaWarmPaths,
  scheduleBrowserMediaWarm,
} from "@/lib/media/browser-warm";

/**
 * After sign-in in the browser, quietly batch-sign and prefetch catalog
 * covers so Tracks / Scenes / Artist fill in faster on the next open.
 */
export function useBrowserMediaWarm() {
  const { activeArtist } = useActiveArtist();
  const { activeSpaceId } = useActiveSpace();
  const artistId = activeArtist?.id ?? null;

  React.useEffect(() => {
    if (isDesktopApp()) return;
    const controller = new AbortController();
    scheduleBrowserMediaWarm(
      () => collectCatalogMediaWarmPaths(artistId, activeSpaceId),
      { signal: controller.signal }
    );
    return () => controller.abort();
  }, [activeSpaceId, artistId]);
}
