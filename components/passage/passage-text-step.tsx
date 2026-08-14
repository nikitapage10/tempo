"use client";

import * as React from "react";
import { ChevronLeft, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MorphingText } from "@/components/ui/morphing-text";
import {
  ORIGIN_FIT_BODY,
  ORIGIN_FIT_FOOTER,
  ORIGIN_FIT_SHELL,
  OriginScrim,
} from "@/components/origin/origin-copy-layer";
import {
  PASSAGE_PANEL,
  PASSAGE_PANEL_TOP_EDGE,
} from "@/components/passage/passage-panel";
import { useOriginSpeech } from "@/hooks/use-origin-speech";
import { cn } from "@/lib/utils";

/**
 * One open question, held on its own loop. Frames 4 to 6 of PASSAGE (entry,
 * support, function) all share this shape. Only the copy and the field change
 * between them.
 *
 * Speaking and typing are equal paths, the same as Origin's introduction step:
 * the transcript is an ordinary editable textarea at all times, so a denied
 * microphone or an unsupported browser costs nothing but the dictation.
 */
export function PassageTextStep({
  kicker,
  heading,
  prompt,
  placeholder,
  value,
  onValueChange,
  onBack,
  onFinish,
  onSkipAll,
  mediaReady = true,
  continueLabel = "Continue",
  maxChars = 2000,
  busy,
}: {
  kicker: string;
  heading: string;
  prompt: string;
  placeholder: string;
  value: string;
  onValueChange: (v: string) => void;
  onBack: () => void;
  onFinish: () => void;
  /** Leaves the whole flow, not just this question. */
  onSkipAll?: () => void;
  /** False while the next clip is still buffering. See use-passage-media. */
  mediaReady?: boolean;
  continueLabel?: string;
  maxChars?: number;
  busy: boolean;
}) {
  /**
   * Nothing here is required. These are questions about a person, not a form
   * that has to validate. Someone who would rather get on with the work can
   * pass any of them, and everything stays editable in Settings afterwards.
   */
  const answered = value.trim().length > 0;

  // Text present before dictation started, so speaking adds to existing typing.
  const baseTextRef = React.useRef("");
  const valueRef = React.useRef(value);
  valueRef.current = value;

  const speech = useOriginSpeech({
    onTranscript: onValueChange,
    baseText: () => baseTextRef.current,
  });

  const [attempted, setAttempted] = React.useState(false);
  const waiting = attempted && !mediaReady;

  React.useEffect(() => {
    if (attempted && mediaReady) onFinish();
  }, [attempted, mediaReady, onFinish]);

  async function handleDictation() {
    if (speech.listening) {
      await speech.finish();
      return;
    }
    baseTextRef.current = valueRef.current.trim();
    await speech.start();
  }

  function handleContinue() {
    if (busy) return;
    setAttempted(true);
    if (mediaReady) onFinish();
  }

  const canSpeak = speech.mode !== "unavailable" && !speech.micDenied;

  return (
    <OriginScrim
      className={cn(
        "pointer-events-auto relative flex w-full max-w-2xl flex-col gap-0 overflow-hidden p-0",
        ORIGIN_FIT_SHELL,
        PASSAGE_PANEL
      )}
    >
      <span aria-hidden className={PASSAGE_PANEL_TOP_EDGE} />
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-px bg-[linear-gradient(to_bottom,transparent,var(--amber),var(--ice),transparent)] opacity-70"
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
          <p className="text-[11px] uppercase tracking-[0.28em] text-text-lo/80">{kicker}</p>
          <MorphingText
            as="h1"
            texts={[heading]}
            loop={false}
            className="font-display text-3xl leading-tight text-text-hi sm:text-4xl [&>span]:text-left"
          />
          {/* Brighter than text-lo: this sits over film, not over the app's
              flat background, and at text-lo it was washing out entirely. */}
          <p className="max-w-lg text-sm leading-relaxed text-text-hi/75">{prompt}</p>
        </div>

        <div className="relative flex flex-col gap-2 pl-5 before:absolute before:inset-y-1 before:left-0 before:w-px before:bg-[linear-gradient(to_bottom,var(--ice),var(--amber),transparent)]">
          <label htmlFor={`passage-text-${kicker}`} className="sr-only">
            {heading}
          </label>
          <Textarea
            id={`passage-text-${kicker}`}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            rows={5}
            maxLength={maxChars}
            placeholder={placeholder}
            className="min-h-24 resize-none rounded-none border-0 bg-transparent px-0 text-base leading-relaxed text-text-hi shadow-none placeholder:text-text-lo/70 focus-visible:ring-0 sm:min-h-32"
            aria-describedby={`passage-status-${kicker}`}
          />
          {/* Restrained live region: state changes, not every word heard. */}
          <p
            id={`passage-status-${kicker}`}
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

        {speech.error ? (
          <p role="alert" className="text-xs text-warn">
            {speech.error}
          </p>
        ) : null}
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
              <Mic
                className={
                  speech.listening ? "animate-pulse motion-reduce:animate-none" : undefined
                }
              />
              {speech.listening
                ? "Listening…"
                : speech.transcribing
                  ? "Finishing…"
                  : answered
                    ? "Dictate more"
                    : "Dictate"}
            </Button>
          ) : null}
          {onSkipAll ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSkipAll}
              disabled={busy}
              className="text-text-lo"
            >
              Skip for now
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            onClick={handleContinue}
            disabled={busy || speech.listening || speech.transcribing}
            className="ml-auto rounded-full border border-line/80 bg-white/[0.035] px-5 text-text-hi hover:border-ice/50 hover:bg-ice/[0.06] hover:text-text-hi"
          >
            {waiting ? "One moment…" : answered ? continueLabel : "Pass on this one"}
          </Button>
        </div>
      </div>
    </OriginScrim>
  );
}
