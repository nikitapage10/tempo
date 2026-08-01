"use client";

import * as React from "react";
import { MorphingText } from "@/components/ui/morphing-text";
import { cn } from "@/lib/utils";

/**
 * The moment before ORIGIN begins.
 *
 * One line at a time, each melting into the next — this is the entity's voice,
 * and it uses the morphing treatment everywhere it speaks.
 *
 * The whole viewport is the target, because the copy says "tap anywhere" and
 * that should be true. The visible prompt is a label, not the hit area.
 *
 * The tap is also load-bearing: browsers refuse audible playback until a page
 * has had a real user gesture, so this is what lets the film open with sound.
 */

const LINES = [
  "Something is listening.",
  "A pulse, finding its footing.",
  "Every story begins here.",
];

/** Beat of stillness before anything speaks. The screen should feel dormant. */
const OPENING_DELAY_MS = 850;
/** How long the copy takes to clear before the film is allowed to come up. */
const EXIT_MS = 1100;

export function OriginAwakenStep({
  onBegin,
  staticMode,
}: {
  onBegin: () => void;
  staticMode: boolean;
}) {
  const [settled, setSettled] = React.useState(staticMode);
  /** Held back so the first line arrives into silence rather than on load. */
  const [started, setStarted] = React.useState(staticMode);
  const [leaving, setLeaving] = React.useState(false);

  React.useEffect(() => {
    if (staticMode) return;
    const t = setTimeout(() => setStarted(true), OPENING_DELAY_MS);
    return () => clearTimeout(t);
  }, [staticMode]);

  const begin = React.useCallback(() => {
    if (leaving || !started) return;
    // The copy clears first, then the film comes up into the space it left.
    setLeaving(true);
    setTimeout(onBegin, EXIT_MS);
  }, [leaving, started, onBegin]);

  return (
    <button
      type="button"
      onClick={begin}
      aria-label="Begin"
      // Covers the viewport so the invitation is literally true. Sits under the
      // overlay's own padding, so the copy still lands middle-right.
      className="pointer-events-auto fixed inset-0 z-10 cursor-pointer focus-visible:outline-none"
    >
      {/* The opening frame is busy where the copy sits, so the right side is
          pulled down before the first line arrives. Sized generously and
          feathered hard so it reads as depth in the image, not as a panel. */}
      <span
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_78%_50%,rgba(6,6,9,0.92),rgba(6,6,9,0.72)_45%,transparent_75%)]"
      />
      {/* The gradient has a visible edge against the still. On the way out it
          floods to full black first, so the film comes up from darkness rather
          than from a half-lit frame with a seam across it. */}
      <span
        aria-hidden
        className="absolute inset-0 bg-[var(--bg-0)] transition-opacity ease-in motion-reduce:transition-none"
        style={{ opacity: leaving ? 1 : 0, transitionDuration: `${EXIT_MS * 0.8}ms` }}
      />

      <span
        className={cn(
          "absolute inset-0 flex flex-col justify-center items-stretch px-5 sm:items-end sm:pr-[14vw]",
          "transition-opacity ease-in-out motion-reduce:transition-none",
          leaving ? "opacity-0" : started ? "opacity-100" : "opacity-0"
        )}
        style={{ transitionDuration: leaving ? `${EXIT_MS}ms` : "1200ms" }}
      >
        <span className="flex w-full max-w-md flex-col items-end gap-6 text-right">
          {started ? (
            <MorphingText
              as="h1"
              texts={staticMode ? [LINES[LINES.length - 1]] : LINES}
              loop={false}
              onSettled={() => setSettled(true)}
              className="font-display text-3xl leading-snug text-text-hi sm:text-4xl [&>span]:text-right"
            />
          ) : (
            <span className="h-14" />
          )}

          <span
            className={cn(
              "flex items-center gap-2 text-sm text-text-lo",
              "transition-opacity duration-[1500ms] ease-out motion-reduce:transition-none",
              settled ? "opacity-100" : "opacity-0"
            )}
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-ice opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-ice" />
            </span>
            Tap anywhere to begin
          </span>
        </span>
      </span>
    </button>
  );
}
