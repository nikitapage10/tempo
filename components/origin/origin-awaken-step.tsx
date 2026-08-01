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

export function OriginAwakenStep({
  onBegin,
  staticMode,
}: {
  onBegin: () => void;
  staticMode: boolean;
}) {
  const [settled, setSettled] = React.useState(staticMode);

  return (
    <button
      type="button"
      onClick={onBegin}
      aria-label="Begin"
      // Covers the viewport so the invitation is literally true. Sits under the
      // overlay's own padding, so the copy still lands middle-right.
      className="pointer-events-auto fixed inset-0 z-10 cursor-pointer focus-visible:outline-none"
    >
      <span className="absolute inset-0 flex flex-col justify-center items-stretch px-5 sm:items-end sm:pr-[14vw]">
        <span className="flex w-full max-w-md flex-col items-end gap-6 text-right">
          <MorphingText
            as="h1"
            texts={staticMode ? [LINES[LINES.length - 1]] : LINES}
            loop={false}
            onSettled={() => setSettled(true)}
            className="h-16 font-display text-2xl leading-snug text-text-hi sm:text-3xl [&>span]:text-right"
          />

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
