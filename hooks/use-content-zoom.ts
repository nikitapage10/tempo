"use client";

import * as React from "react";
import {
  nudgeContentZoom,
  readContentZoom,
  subscribeContentZoom,
  writeContentZoom,
} from "@/lib/desktop/content-zoom";
import {
  isDesktopApp,
  onDesktopZoomNudge,
  resetNativePageZoom,
} from "@/lib/desktop/bridge";

/**
 * Desktop: content zoom factor for the main column only. Web always 1.
 * Also clears any leftover Chromium page zoom from older desktop builds.
 */
export function useContentZoom(): {
  factor: number;
  zoomIn: () => number;
  zoomOut: () => number;
  zoomReset: () => number;
} {
  const [factor, setFactor] = React.useState(1);

  React.useEffect(() => {
    if (!isDesktopApp()) return;

    void resetNativePageZoom();
    setFactor(readContentZoom());

    const unsubStore = subscribeContentZoom(setFactor);
    const unsubShell = onDesktopZoomNudge((delta) => {
      setFactor(nudgeContentZoom(delta));
    });

    return () => {
      unsubStore();
      unsubShell();
    };
  }, []);

  return {
    factor: isDesktopApp() ? factor : 1,
    zoomIn: () => {
      const next = nudgeContentZoom(0.1);
      setFactor(next);
      return next;
    },
    zoomOut: () => {
      const next = nudgeContentZoom(-0.1);
      setFactor(next);
      return next;
    },
    zoomReset: () => {
      const next = writeContentZoom(1);
      setFactor(next);
      return next;
    },
  };
}
