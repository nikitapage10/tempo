"use client";

import type { CSSProperties } from "react";
import { Minus, Plus } from "lucide-react";
import { useContentZoom } from "@/hooks/use-content-zoom";
import { useLabeledRail } from "@/hooks/use-labeled-rail";
import { isDesktopApp } from "@/lib/desktop/bridge";
import { railLayoutWidthPx } from "@/lib/desktop/content-zoom";
import { cn } from "@/lib/utils";

/**
 * Desktop-only interface zoom. In the studio it sits past the rail; on
 * full-bleed surfaces (Origin) it pins to the bottom-left corner.
 */
export function ZoomControl({
  placement = "rail",
}: {
  placement?: "rail" | "corner";
}) {
  const { factor, zoomIn, zoomOut, zoomReset } = useContentZoom();
  const labeledRail = useLabeledRail();
  const railWidth = railLayoutWidthPx(factor, labeledRail);

  if (!isDesktopApp()) return null;

  const percent = Math.round(factor * 100);
  const corner = placement === "corner";
  // 16px gutter past the live rail width (compact or zoom-grown labeled).
  const leftPx = railWidth + 16;

  return (
    <div
      className={cn(
        "fixed z-[90] flex h-9 items-center gap-0.5 rounded-full border border-line bg-bg-2 px-1 text-text-lo shadow-e3 [-webkit-app-region:no-drag]",
        corner
          ? "bottom-5 left-4"
          : "bottom-20 left-4 md:bottom-5 md:left-[var(--tempo-zoom-left)]"
      )}
      style={
        corner
          ? undefined
          : ({
              ["--tempo-zoom-left"]: `${leftPx}px`,
            } as CSSProperties)
      }
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
