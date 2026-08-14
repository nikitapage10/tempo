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
import { useOriginSpeech } from "@/hooks/use-origin-speech";
import { MIN_INTRODUCTION_CHARS, validateIntroduction } from "@/lib/origin/validation";
import { cn } from "@/lib/utils";

/**
 * Frame 3 — the artist talks, and TEMPO listens.
 *
 * Speaking and typing are equal paths: the transcript is a normal editable
 * textarea at all times, so a denied microphone, an unsupported browser, or a
 * failed transcription costs the artist nothing but the dictation itself.
 */

/**
 * Suggestions, never a questionnaire. Written to be answerable sideways — an
 * artist should be able to ignore all four and still say something true.
 */
const PROMPTS = [
  "The first sound that changed how you listened.",
  "A moment when music began to feel like yours.",
  "An influence you can still hear in your work.",
  "A feeling you keep trying to reach.",
  "Something that changed… and something that remained.",
  "The direction pulling you forward now.",
];

export function OriginIntroductionStep({
  introduction,
  onIntroductionChange,
  onFinish,
  onBack,
  onRecordingChange,
  voiceActive,
  mediaReady,
  busy,
}: {
  introduction: string;
  onIntroductionChange: (v: string) => void;
  onFinish: () => void;
  onBack: () => void;
  onRecordingChange: (recording: boolean) => void;
  /** Starts the entity voice only once the panel's reveal has begun. */
  voiceActive: boolean;
  mediaReady: boolean;
  busy: boolean;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [attempted, setAttempted] = React.useState(false);
  const [voiceStarted, setVoiceStarted] = React.useState(voiceActive);

  React.useEffect(() => {
    if (voiceActive) setVoiceStarted(true);
  }, [voiceActive]);

  // Text present before dictation started, so speaking adds to existing typing.
  const baseTextRef = React.useRef("");
  const introRef = React.useRef(introduction);
  introRef.current = introduction;

  const speech = useOriginSpeech({
    onTranscript: onIntroductionChange,
    baseText: () => baseTextRef.current,
  });

  React.useEffect(() => {
    onRecordingChange(speech.listening);
  }, [speech.listening, onRecordingChange]);

  const waiting = attempted && !mediaReady;

  React.useEffect(() => {
    if (attempted && mediaReady && !error) onFinish();
  }, [attempted, mediaReady, error, onFinish]);

  async function handleDictation() {
    if (speech.listening) {
      await speech.finish();
      return;
    }
    baseTextRef.current = introRef.current.trim();
    setError(null);
    await speech.start();
  }

  function handleContinue() {
    if (busy) return;
    const result = validateIntroduction(introduction);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setAttempted(true);
    if (mediaReady) onFinish();
  }

  const canSpeak = speech.mode !== "unavailable" && !speech.micDenied;
  const remaining = Math.max(0, MIN_INTRODUCTION_CHARS - introduction.trim().length);

  return (
    <OriginScrim
      className={cn(
        "pointer-events-auto relative flex w-full max-w-2xl flex-col gap-0 overflow-hidden p-0",
        ORIGIN_FIT_SHELL
      )}
    >
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
        <p className="text-[11px] uppercase tracking-[0.28em] text-text-lo/70">
          Signal / in your own words
        </p>
        {voiceStarted ? (
          <MorphingText
            as="h1"
            texts={[
              "Now, give it a history…",
              "What is shaping it now?",
            ]}
            loop={false}
            holdSeconds={1.8}
            className="font-display text-3xl leading-tight text-text-hi sm:text-4xl [&>span]:text-left"
          />
        ) : (
          <div aria-hidden className="h-8 sm:h-9" />
        )}
        <p className="max-w-lg text-sm leading-relaxed text-text-lo">
          Every sound comes from somewhere. Tune the signal with the moments,
          influences, and instincts that shaped yours. Start with what first pulled
          you toward music, what keeps returning, and what is calling you forward now.
        </p>
      </div>

      {/* Suggestions, not required questions. */}
      <div className="flex items-center gap-3 border-y border-line/50 py-3">
        <span className="relative flex size-2 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber/70 motion-reduce:hidden" />
          <span className="relative inline-flex size-2 rounded-full bg-amber" />
        </span>
        <MorphingText
          as="p"
          texts={PROMPTS}
          loop
          holdSeconds={2.7}
          morphSeconds={0.85}
          blurPx={2}
          className="text-sm italic text-text-lo/85 [&>span]:text-left"
        />
      </div>

      <div className="relative flex flex-col gap-2 pl-5 before:absolute before:inset-y-1 before:left-0 before:w-px before:bg-[linear-gradient(to_bottom,var(--ice),var(--amber),transparent)]">
        <label htmlFor="origin-introduction" className="sr-only">
          Your introduction
        </label>
        <Textarea
          id="origin-introduction"
          value={introduction}
          onChange={(e) => {
            onIntroductionChange(e.target.value);
            if (error) setError(null);
          }}
          rows={6}
          placeholder={
            "Start with where the signal began…"
          }
          className="min-h-24 resize-none rounded-none border-0 bg-transparent px-0 text-base leading-relaxed shadow-none focus-visible:ring-0 sm:min-h-36"
          aria-describedby="origin-intro-status origin-intro-privacy"
        />

        {/* Restrained live region: state changes, not every word heard. */}
        <p id="origin-intro-status" aria-live="polite" className="min-h-4 text-xs text-text-lo">
          {speech.transcribing
            ? "Writing down what you said…"
            : speech.listening
              ? "Listening… pause for a moment or tap the microphone to stop."
              : remaining > 0 && introduction.trim().length > 0
                ? "Keep going a little."
                : ""}
        </p>
      </div>

      {speech.error ? (
        <p role="alert" className="text-xs text-warn">
          {speech.error}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-warn">
          {error}
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
              <Mic className={speech.listening ? "animate-pulse motion-reduce:animate-none" : undefined} />
              {speech.listening
                ? "Listening…"
                : speech.transcribing
                  ? "Finishing…"
                  : introduction.trim()
                    ? "Dictate more"
                    : "Dictate"}
            </Button>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            onClick={handleContinue}
            disabled={busy || speech.listening || speech.transcribing}
            className="ml-auto rounded-full border border-line/80 bg-white/[0.035] px-5 text-text-hi hover:border-ice/50 hover:bg-ice/[0.06] hover:text-text-hi"
          >
            {waiting ? "One moment…" : "Shape the signal →"}
          </Button>
        </div>
        <p id="origin-intro-privacy" className="mt-2.5 text-xs leading-relaxed text-text-lo/80">
          Your words are sent to be transcribed and interpreted. The recording itself is not
          kept. Nothing is published without your confirmation.
        </p>
      </div>
    </OriginScrim>
  );
}
