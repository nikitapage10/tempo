"use client";

import { Minus, Plus } from "lucide-react";
import { useContentZoom } from "@/hooks/use-content-zoom";
import { isDesktopApp } from "@/lib/desktop/bridge";
import { cn } from "@/lib/utils";

/**
 * Desktop-only interface zoom — floats near the rail edge. Scales the main
 * workspace only (left rail stays put). Ctrl/Cmd +/- / 0 match this control.
 *
 * md:left clears the compact icon rail; xl:left clears the full labeled rail.
 */
export function ZoomControl() {
  const { factor, zoomIn, zoomOut, zoomReset } = useContentZoom();

  if (!isDesktopApp()) return null;

  const percent = Math.round(factor * 100);

  return (
    <div
      className={cn(
        "fixed bottom-20 left-4 z-[90] flex h-9 items-center gap-0.5 rounded-full border border-line bg-bg-2 px-1 text-text-lo shadow-e3 [-webkit-app-region:no-drag]",
        "md:bottom-5 md:left-[84px] xl:left-[236px]"
      )}
    >
      <button
        type="button"
        onClick={() => zoomOut()}
        aria-label="Zoom out"
        className="flex size-7 items-center justify-center rounded-full transition-colors hover:bg-bg-3 hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
      >
        <Minus className="size-3.5" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={() => zoomReset()}
        aria-label="Reset zoom to 100%"
        title="Reset zoom"
        className="min-w-[2.75rem] rounded-full px-1 text-center font-mono text-[11px] transition-colors hover:bg-bg-3 hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
      >
        {percent}%
      </button>
      <button
        type="button"
        onClick={() => zoomIn()}
        aria-label="Zoom in"
        className="flex size-7 items-center justify-center rounded-full transition-colors hover:bg-bg-3 hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
      >
        <Plus className="size-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
}
