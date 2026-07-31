"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The moment before ORIGIN begins.
 *
 * Three lines surface one after another over the first poster, then an
 * invitation to start. The invitation is not decoration: browsers refuse to
 * play video with sound until the page has had a real user gesture, so this tap
 * is what lets the film open with its own audio instead of silently.
 *
 * The whole panel is the target — there is no small button to hunt for.
 */

const LINES = [
  "Something is listening.",
  "A pulse, finding its footing.",
  "Every story begins here.",
];

/** Gap between lines surfacing. Slow enough to read as breathing, not loading. */
const LINE_DELAY_MS = 1150;

export function OriginAwakenStep({
  onBegin,
  staticMode,
}: {
  onBegin: () => void;
  staticMode: boolean;
}) {
  const [shown, setShown] = React.useState(staticMode ? LINES.length : 0);

  React.useEffect(() => {
    if (staticMode) return;
    const timers = LINES.map((_, i) =>
      setTimeout(() => setShown((n) => Math.max(n, i + 1)), LINE_DELAY_MS * (i + 1))
    );
    return () => timers.forEach(clearTimeout);
  }, [staticMode]);

  const ready = shown >= LINES.length;

  return (
    <button
      type="button"
      onClick={onBegin}
      className={cn(
        "pointer-events-auto group flex w-full max-w-md flex-col items-end gap-4 text-right",
        "rounded-panel p-6 transition-colors duration-500",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
      )}
    >
      <h1 className="sr-only">Begin your Origin</h1>

      {LINES.map((line, i) => (
        <p
          key={line}
          aria-hidden={i >= shown}
          className={cn(
            "font-display text-2xl leading-snug text-text-hi sm:text-3xl",
            "transition-all duration-[1200ms] ease-out motion-reduce:transition-none",
            i < shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          )}
        >
          {line}
        </p>
      ))}

      <span
        className={cn(
          "mt-2 flex items-center gap-2 text-sm text-text-lo",
          "transition-opacity duration-1000 motion-reduce:transition-none",
          ready ? "opacity-100" : "opacity-0"
        )}
      >
        {/* A slow pulse, echoing the premise rather than nagging for a click. */}
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-ice opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex size-2 rounded-full bg-ice" />
        </span>
        <span className="group-hover:text-text-hi">Tap anywhere to begin</span>
      </span>
    </button>
  );
}
