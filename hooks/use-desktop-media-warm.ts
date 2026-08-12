"use client";

import * as React from "react";
import { useActiveArtist } from "@/components/active-artist-provider";
import { useActiveSpace } from "@/components/active-space-provider";
import { isDesktopApp } from "@/lib/desktop/bridge";
import {
  collectDesktopMediaWarmPaths,
  scheduleDesktopMediaWarm,
} from "@/lib/desktop/media-warm";

/**
 * After sign-in on TEMPO Desktop, quietly pull track/project/scene/artist
 * imagery into the local vault so the next visit paints from disk.
 */
export function useDesktopMediaWarm() {
  const { activeArtist } = useActiveArtist();
  const { activeSpaceId } = useActiveSpace();
  const artistId = activeArtist?.id ?? null;

  React.useEffect(() => {
    if (!isDesktopApp()) return;
    const controller = new AbortController();
    scheduleDesktopMediaWarm(
      () => collectDesktopMediaWarmPaths(artistId, activeSpaceId),
      { signal: controller.signal }
    );
    return () => controller.abort();
  }, [activeSpaceId, artistId]);
}
