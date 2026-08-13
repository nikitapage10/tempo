"use client";

import * as React from "react";
import { MorphingText } from "@/components/ui/morphing-text";
import { OriginScrim } from "@/components/origin/origin-copy-layer";
import { PASSAGE_PANEL } from "@/components/passage/passage-panel";
import { cn } from "@/lib/utils";

/**
 * The beat while TEMPO reads the answers and writes the closing story.
 *
 * Holds on the same loop the look step used, so nothing in the film changes:
 * this is a pause in the conversation, not a new scene.
 */
const LINES = [
  "Reading that back…",
  "Finding the thread.",
  "Putting it in order.",
];

export function PassageProcessingStep() {
  return (
    <OriginScrim
      className={cn(
        "pointer-events-auto relative w-full max-w-md overflow-hidden p-0 text-left",
        PASSAGE_PANEL
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-px bg-[linear-gradient(to_bottom,transparent,var(--amber),var(--ice),transparent)] opacity-75"
      />
      <div className="relative flex flex-col gap-4 px-7 py-8 sm:px-9">
        <p className="text-[11px] uppercase tracking-[0.28em] text-text-lo/70">
          Passage / reading
        </p>
        <MorphingText
          as="h1"
          texts={LINES}
          loop
          holdSeconds={2.2}
          morphSeconds={0.8}
          className="font-display text-2xl leading-snug text-text-hi sm:text-3xl [&>span]:text-left"
        />
        <div className="flex items-center gap-2 text-sm text-text-lo">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-ice opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-ice" />
          </span>
          This only takes a moment.
        </div>
      </div>
    </OriginScrim>
  );
}
