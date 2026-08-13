"use client";

import * as React from "react";
import { MorphingText } from "@/components/ui/morphing-text";
import { cn } from "@/lib/utils";

/**
 * The moment before PASSAGE begins. Same mechanics as OriginAwakenStep
 * (components/origin/origin-awaken-step.tsx) — a full-viewport tap target
 * that also doubles as the user gesture browsers require for audible video.
 *
 * The copy deliberately avoids Origin's "signal" language. That metaphor is
 * about making the music; the people arriving here manage it, book it, shoot
 * it, design it and put it out, and telling them they *are* the signal would
 * be describing somebody else's job.
 */

const LINES = [
  "No record gets made alone.",
  "Behind every one of them…",
  "are the people who carry it.",
];

const OPENING_DELAY_MS = 850;
const EXIT_MS = 900;

export function PassageAwakenStep({
  onBegin,
  onTuneIn,
  staticMode,
}: {
  onBegin: () => void;
  onTuneIn: () => void;
  staticMode: boolean;
}) {
  const [settled, setSettled] = React.useState(staticMode);
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
    setLeaving(true);
    setTimeout(onBegin, EXIT_MS);
  }, [leaving, started, onBegin, onTuneIn]);

  return (
    <button
      type="button"
      onClick={begin}
      aria-label="Tune in"
      className="pointer-events-auto fixed inset-0 z-10 cursor-pointer focus-visible:outline-none"
    >
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
