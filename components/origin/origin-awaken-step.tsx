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
  "Every artist begins as a signal…",
  "faint at first,",
  "shaped by everything it passes through.",
];

/** Beat of stillness before anything speaks. The screen should feel dormant. */
const OPENING_DELAY_MS = 850;
/** How long the copy takes to clear over the held opening frame. */
const EXIT_MS = 900;

export function OriginAwakenStep({
  onBegin,
  onTuneIn,
  staticMode,
}: {
  onBegin: () => void;
  /** Runs on the tap itself so browser-gated audio can begin immediately. */
  onTuneIn: () => void;
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
    onTuneIn();
    // The copy clears first, then the film comes up into the space it left.
    setLeaving(true);
    setTimeout(onBegin, EXIT_MS);
  }, [leaving, started, onBegin, onTuneIn]);

  return (
    <button
      type="button"
      onClick={begin}
      aria-label="Tune in"
      // Covers the viewport so the invitation is literally true. Sits under the
      // overlay's own padding, so the copy still lands middle-right.
      className="pointer-events-auto fixed inset-0 z-10 cursor-pointer focus-visible:outline-none"
    >
      {/* The opening frame is busy where the copy sits, so the right side is
          pulled down before the first line arrives. Sized generously and
          feathered hard so it reads as depth in the image, not as a panel. */}
      <span
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_78%_50%,rgba(6,6,9,0.9),rgba(6,6,9,0.68)_45%,transparent_75%)] transition-opacity ease-in-out motion-reduce:transition-none"
        style={{ opacity: leaving ? 0 : 1, transitionDuration: `${EXIT_MS}ms` }}
      />

      <span
        className={cn(
          "absolute inset-0 flex flex-col items-stretch justify-center px-5",
          "sm:left-[calc(50%+1.75rem)] sm:right-auto sm:w-[min(42rem,calc(50%-3.5rem))] sm:items-start sm:px-0",
          "transition-opacity ease-in-out motion-reduce:transition-none",
          leaving ? "opacity-0" : started ? "opacity-100" : "opacity-0"
        )}
        style={{ transitionDuration: leaving ? `${EXIT_MS}ms` : "1200ms" }}
      >
        {/* The heading alone is what should sit on the film's centre line, so
            it is the only thing in the centred box. The cue hangs below it
            absolutely — inside the flow it would push the line that matters up
            by half its own height, which is what threw the alignment off. */}
        <span className="relative flex w-full max-w-2xl flex-col items-start text-left">
          {started ? (
            <MorphingText
              as="h1"
              texts={staticMode ? [LINES[LINES.length - 1]] : LINES}
              loop={false}
              onSettled={() => setSettled(true)}
              className="font-display whitespace-normal text-[clamp(1.2rem,6vw,1.875rem)] leading-snug text-text-hi min-[360px]:whitespace-nowrap sm:text-3xl [&>span]:text-left"
            />
          ) : (
            <span className="h-14" />
          )}

          <span
            className={cn(
              "absolute left-0 top-full mt-6 flex items-center gap-2 text-sm text-text-lo",
              "transition-opacity duration-[1500ms] ease-out motion-reduce:transition-none",
              settled ? "opacity-100" : "opacity-0"
            )}
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-ice opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-ice" />
            </span>
            Tune in
          </span>
        </span>
      </span>
    </button>
  );
}
