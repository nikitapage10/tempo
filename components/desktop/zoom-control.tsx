"use client";

import type { CSSProperties } from "react";
import { Minus, Plus } from "lucide-react";
import {
  ONBOARDING_CHROME_FADE_IN_MS,
  ONBOARDING_CHROME_FADE_OUT_MS,
  useOnboardingChromeReveal,
} from "@/components/origin/origin-exit-control";
import { useContentZoom } from "@/hooks/use-content-zoom";
import { useLabeledRail } from "@/hooks/use-labeled-rail";
import { isDesktopApp } from "@/lib/desktop/bridge";
import { railLayoutWidthPx } from "@/lib/desktop/content-zoom";
import { cn } from "@/lib/utils";

/**
 * Desktop-only interface zoom. In the studio it sits past the rail; on
 * full-bleed surfaces (Origin) it pins to the bottom-left corner; Admin
 * sits past its fixed 15rem ops rail.
 */
export function ZoomControl({
  placement = "rail",
  visible = true,
}: {
  placement?: "rail" | "corner" | "admin";
  /** Fades the control in/out rather than mounting it outright — Origin uses
   *  this to hold it back until the artist has tuned in. */
  visible?: boolean;
}) {
  const { factor, zoomIn, zoomOut, zoomReset } = useContentZoom();
  const labeledRail = useLabeledRail();
  const railWidth = railLayoutWidthPx(factor, labeledRail);
  const corner = placement === "corner";
  // Hook must always run; only corner placement actually waits on the delay.
  const chromeVisible = useOnboardingChromeReveal(corner && visible);
  const shown = corner ? chromeVisible : visible;

  if (!isDesktopApp()) return null;

  const percent = Math.round(factor * 100);
  const admin = placement === "admin";
  // 16px gutter past the live rail width (compact or zoom-grown labeled).
  const leftPx = railWidth + 16;

  return (
    <div
      aria-hidden={corner ? !shown : undefined}
      className={cn(
        "fixed z-[90] flex h-9 items-center gap-0.5 rounded-full border border-line bg-bg-2 px-1 text-text-lo shadow-e3 [-webkit-app-region:no-drag]",
        "transition-opacity ease-out motion-reduce:transition-none",
        !corner && "duration-[1400ms]",
        shown ? "opacity-100" : "pointer-events-none opacity-0",
        corner
          ? "bottom-5 left-4"
          : admin
            ? "bottom-20 left-4 md:bottom-5 md:left-[calc(15rem+1rem)]"
            : "bottom-20 left-4 md:bottom-5 md:left-[var(--tempo-zoom-left)]"
      )}
      style={
        {
          ...(corner
            ? {
                transitionDuration: `${shown ? ONBOARDING_CHROME_FADE_IN_MS : ONBOARDING_CHROME_FADE_OUT_MS}ms`,
              }
            : admin
              ? undefined
              : { ["--tempo-zoom-left"]: `${leftPx}px` }),
        } as CSSProperties
      }
    >
      <button
        type="button"
        onClick={() => zoomOut()}
        aria-label="Zoom out"
        tabIndex={shown ? undefined : -1}
        className="flex size-7 items-center justify-center rounded-full transition-colors hover:bg-bg-3 hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
      >
        <Minus className="size-3.5" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={() => zoomReset()}
        aria-label="Reset zoom to default"
        title="Reset zoom to default"
        tabIndex={shown ? undefined : -1}
        className="min-w-[2.75rem] rounded-full px-1 text-center font-mono text-[11px] transition-colors hover:bg-bg-3 hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
      >
        {percent}%
      </button>
      <button
        type="button"
        onClick={() => zoomIn()}
        aria-label="Zoom in"
        tabIndex={shown ? undefined : -1}
        className="flex size-7 items-center justify-center rounded-full transition-colors hover:bg-bg-3 hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
      >
        <Plus className="size-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
}
