"use client";

import * as React from "react";
import { ArrowRight, ChevronLeft, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MorphingText } from "@/components/ui/morphing-text";
import { OriginScrim, ORIGIN_FIT_BODY, ORIGIN_FIT_FOOTER, ORIGIN_FIT_SHELL } from "@/components/origin/origin-copy-layer";
import { useOriginSpeech } from "@/hooks/use-origin-speech";
import { validateDirection } from "@/lib/origin/validation";
import { cn } from "@/lib/utils";

const PROMPTS = [
  "What are you creating or releasing now?",
  "What feeling are you trying to capture?",
  "What is changing in your sound?",
  "What do you want to explore next?",
];

export function OriginDirectionStep({
  direction,
  onDirectionChange,
  onBack,
  onFinish,
  busy,
  mediaReady = true,
}: {
  direction: string;
  onDirectionChange: (value: string) => void;
  onBack: () => void;
  onFinish: () => void;
  busy: boolean;
  mediaReady?: boolean;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [attempted, setAttempted] = React.useState(false);
  const baseTextRef = React.useRef("");
  const directionRef = React.useRef(direction);
  directionRef.current = direction;

  const speech = useOriginSpeech({
    onTranscript: onDirectionChange,
    baseText: () => baseTextRef.current,
  });

  const waiting = attempted && !mediaReady;

  React.useEffect(() => {
    if (attempted && mediaReady && !error) onFinish();
  }, [attempted, mediaReady, error, onFinish]);

  async function handleDictation() {
    if (speech.listening) {
      await speech.finish();
      return;
    }
    baseTextRef.current = directionRef.current.trim();
    setError(null);
    await speech.start();
  }

  function handleContinue() {
    if (busy) return;
    const result = validateDirection(direction);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setAttempted(true);
    if (mediaReady) onFinish();
  }

  const canSpeak = speech.mode !== "unavailable" && !speech.micDenied;

  return (
    <OriginScrim
      tone="story"
      className={cn(
        "pointer-events-auto relative flex w-full max-w-2xl flex-col overflow-hidden border-line bg-[linear-gradient(135deg,rgb(7_8_11/0.88),rgb(14_15_20/0.80))] p-0 shadow-[0_24px_80px_rgb(0_0_0/0.52)] backdrop-blur-2xl",
        ORIGIN_FIT_SHELL
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-px bg-[linear-gradient(to_bottom,transparent,var(--ice),var(--amber),transparent)] opacity-75"
      />
      <div className={cn(ORIGIN_FIT_BODY, "flex flex-col gap-6 px-7 py-8 sm:px-9")}>
        <button
          type="button"
          onClick={onBack}
          className="flex w-fit items-center gap-1 text-xs text-text-lo transition-colors hover:text-text-hi"
        >
          <ChevronLeft className="size-3.5" /> Back
        </button>

        <div className="flex flex-col gap-3">
          <p className="text-[11px] uppercase tracking-[0.28em] text-text-lo/70">
            Direction / 02
          </p>
          <MorphingText
            as="h1"
            texts={["Your history gave the signal a source…", "Now, where are you taking it?"]}
            loop={false}
            holdSeconds={2}
            className="font-display text-3xl leading-tight text-text-hi sm:text-4xl [&>span]:text-left"
          />
          <p className="max-w-xl text-sm leading-relaxed text-text-hi/75">
            What are you making right now, and what do you want it to feel like?
            Talk about the releases, sounds, or ideas currently taking shape.
          </p>
        </div>

        <div className="flex items-center gap-3 border-y border-line/50 py-3">
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-ice/60 motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-ice" />
          </span>
          <MorphingText
            as="p"
            texts={PROMPTS}
            loop
            holdSeconds={2.7}
            morphSeconds={0.85}
            blurPx={2}
            className="text-sm italic text-text-hi/75 [&>span]:text-left"
          />
        </div>

        <div className="relative flex flex-col gap-2 pl-5 before:absolute before:inset-y-1 before:left-0 before:w-px before:bg-[linear-gradient(to_bottom,var(--ice),var(--amber),transparent)]">
          <Textarea
            value={direction}
            onChange={(event) => {
              onDirectionChange(event.target.value);
              if (error) setError(null);
            }}
            rows={5}
            maxLength={4000}
            placeholder="Start with what is taking shape now…"
            aria-label="What you are making now and what you want it to feel like"
            aria-describedby="origin-direction-status origin-direction-privacy"
            className="min-h-24 resize-none rounded-none border-0 bg-transparent px-0 text-base leading-relaxed text-text-hi shadow-none placeholder:text-text-lo focus-visible:ring-0 sm:min-h-32"
          />
          <p
            id="origin-direction-status"
            aria-live="polite"
            className="min-h-4 text-xs text-text-lo"
          >
            {speech.transcribing
              ? "Writing down what you said…"
              : speech.listening
                ? "Listening… pause for a moment or tap the microphone to stop."
                : ""}
          </p>
        </div>

        {speech.error ? <p role="alert" className="text-xs text-warn">{speech.error}</p> : null}

        {error ? <p role="alert" className="text-xs text-warn">{error}</p> : null}
      </div>

      <div className={ORIGIN_FIT_FOOTER}>
        <div className="flex flex-wrap items-center gap-2">
          {canSpeak ? (
            <Button
              type="button"
              variant="secondary"
              onClick={handleDictation}
              disabled={speech.transcribing}
              aria-pressed={speech.listening}
              className={speech.listening ? "border-ice/70 bg-ice/10 text-ice" : undefined}
            >
              <Mic className={speech.listening ? "animate-pulse motion-reduce:animate-none" : undefined} />
              {speech.listening
                ? "Listening…"
                : speech.transcribing
                  ? "Finishing…"
                  : direction.trim()
                    ? "Dictate more"
                    : "Dictate"}
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={handleContinue}
            disabled={busy || speech.listening || speech.transcribing}
            className="ml-auto rounded-full px-5"
          >
            {waiting ? "Preparing…" : "Set the direction"}{" "}
            <ArrowRight className="size-4" />
          </Button>
        </div>
        <p id="origin-direction-privacy" className="mt-2.5 text-xs leading-relaxed text-text-lo/80">
          Your words are sent to be transcribed and interpreted. The recording itself is not
          kept. Nothing is published without your confirmation.
        </p>
      </div>
    </OriginScrim>
  );
}
