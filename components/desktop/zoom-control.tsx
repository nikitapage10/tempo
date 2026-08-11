"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { getZoomFactor, isDesktopApp, zoomIn, zoomOut, zoomReset } from "@/lib/desktop/bridge";
import { cn } from "@/lib/utils";

/**
 * Desktop-only interface zoom, visible on every screen next to the download
 * button (components/app-shell.tsx) — there's no visible menu bar to carry
 * this as a "View" menu item (see electron/main.js), and the artist asked
 * for it to be reachable without memorizing Ctrl+=/-, which still work too.
 */
export function ZoomControl() {
  const [mounted, setMounted] = React.useState(false);
  const [factor, setFactor] = React.useState(1);

  React.useEffect(() => {
    setMounted(true);
    if (!isDesktopApp()) return;
    void getZoomFactor().then(setFactor);
  }, []);

  if (!mounted || !isDesktopApp()) return null;

  const percent = Math.round(factor * 100);

  return (
    <div className="flex h-10 items-center gap-0.5 rounded-input border border-line/60 bg-bg-1 px-1 text-text-lo/60">
      <button
        type="button"
        onClick={() => void zoomOut().then(setFactor)}
        aria-label="Zoom out"
        className="flex size-7 items-center justify-center rounded-input transition-colors hover:bg-bg-2 hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
      >
        <Minus className="size-3.5" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={() => void zoomReset().then(setFactor)}
        aria-label="Reset zoom to 100%"
        title="Reset zoom"
        className={cn(
          "min-w-[3.25rem] rounded-input px-1 text-center font-mono text-[11px] transition-colors hover:bg-bg-2 hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
        )}
      >
        {percent}%
      </button>
      <button
        type="button"
        onClick={() => void zoomIn().then(setFactor)}
        aria-label="Zoom in"
        className="flex size-7 items-center justify-center rounded-input transition-colors hover:bg-bg-2 hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
      >
        <Plus className="size-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
}
