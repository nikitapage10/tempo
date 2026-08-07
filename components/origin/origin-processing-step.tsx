"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { OriginScrim } from "@/components/origin/origin-copy-layer";
import { MorphingText } from "@/components/ui/morphing-text";

/**
 * Frame 4 — the hold while interpretation runs.
 *
 * No percentage and no progress bar: the loop is a mood, not a measure, and
 * pretending it tracks the model would be a lie the artist can feel. The loop
 * simply runs until there is something to show.
 */
export function OriginProcessingStep({
  announce,
  voiceActive,
}: {
  announce: boolean;
  voiceActive: boolean;
}) {
  const [voiceStarted, setVoiceStarted] = React.useState(voiceActive);

  React.useEffect(() => {
    if (voiceActive) setVoiceStarted(true);
  }, [voiceActive]);

  return (
    <OriginScrim tone="veil" className="pointer-events-none max-w-md text-center">
      {voiceStarted ? (
        <MorphingText
          as="h1"
          texts={["The signal has a history now.", "Letting its frequencies come through…"]}
          loop={false}
          holdSeconds={2.8}
          morphSeconds={1.8}
          className="font-display text-2xl leading-snug text-text-hi sm:text-3xl [&>span]:text-center"
        />
      ) : (
        <div aria-hidden className="h-8 sm:h-9" />
      )}
      {/* Announced once, when the wait actually ends. */}
      <p aria-live="polite" className="sr-only">
        {announce ? "Your interpretation is ready." : ""}
      </p>
    </OriginScrim>
  );
}

/**
 * Interpretation failed. The transcript and every draft value are still in
 * state — this offers a way onward, never a reset.
 */
export function OriginInterpretationError({
  message,
  onRetry,
  onWriteManually,
  busy,
}: {
  message: string;
  onRetry: () => void;
  onWriteManually: () => void;
  busy: boolean;
}) {
  return (
    <OriginScrim className="pointer-events-auto w-full max-w-md">
      <h1 className="font-display text-xl text-text-hi">That didn&rsquo;t come back.</h1>
      <p className="mt-2 text-sm text-text-lo">{message}</p>
      <p className="mt-2 text-sm text-text-lo">
        What you said is safe. You can try again, or write this part yourself.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="button" onClick={onRetry} disabled={busy}>
          Try again
        </Button>
        <Button type="button" variant="secondary" onClick={onWriteManually} disabled={busy}>
          Write this myself
        </Button>
      </div>
    </OriginScrim>
  );
}
