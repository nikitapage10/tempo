"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { getZoomFactor, isDesktopApp, zoomIn, zoomOut, zoomReset } from "@/lib/desktop/bridge";
import { cn } from "@/lib/utils";

/**
 * Desktop-only interface zoom — floats bottom-left, mirroring the floating
 * assistant launcher's bottom-right position/offsets
 * (components/assistant/assistant-launcher.tsx: `fixed bottom-20 right-4
 * z-[90] ... md:bottom-5 md:right-5`) so the two read as a matched pair of
 * persistent utility controls. There's no visible menu bar to carry this as
 * a "View" menu item instead (see electron/main.js); Ctrl+=/-/0 still work
 * as shortcuts alongside it.
 *
 * The left edge of the *window* is the 220px rail (components/app-shell.tsx),
 * not open page background, so anchoring to left-4/left-5 the way the
 * assistant anchors to right-4/right-5 sat the control on top of the nav.
 * md:left-[236px] clears the rail (220px + a 16px gutter) once it's showing;
 * below that breakpoint the rail is hidden in favor of the bottom tab bar,
 * so plain left-4 is correct there.
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
    <div
      className={cn(
        "fixed bottom-20 left-4 z-[90] flex h-9 items-center gap-0.5 rounded-full border border-line bg-bg-2 px-1 text-text-lo shadow-e3 [-webkit-app-region:no-drag] md:bottom-5 md:left-[236px]"
      )}
    >
      <button
        type="button"
        onClick={() => void zoomOut().then(setFactor)}
        aria-label="Zoom out"
        className="flex size-7 items-center justify-center rounded-full transition-colors hover:bg-bg-3 hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
      >
        <Minus className="size-3.5" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={() => void zoomReset().then(setFactor)}
        aria-label="Reset zoom to 100%"
        title="Reset zoom"
        className="min-w-[2.75rem] rounded-full px-1 text-center font-mono text-[11px] transition-colors hover:bg-bg-3 hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
      >
        {percent}%
      </button>
      <button
        type="button"
        onClick={() => void zoomIn().then(setFactor)}
        aria-label="Zoom in"
        className="flex size-7 items-center justify-center rounded-full transition-colors hover:bg-bg-3 hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
      >
        <Plus className="size-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
}
