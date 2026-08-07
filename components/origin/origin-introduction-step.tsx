"use client";

import * as React from "react";
import { Mic, Pause, Play, RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MorphingText } from "@/components/ui/morphing-text";
import { OriginScrim } from "@/components/origin/origin-copy-layer";
import { formatElapsed, useOriginSpeech } from "@/hooks/use-origin-speech";
import { MIN_INTRODUCTION_CHARS, validateIntroduction } from "@/lib/origin/validation";

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
  "When did music first begin to feel like yours?",
  "What do you lose track of time making?",
  "What feeling do you keep trying to reach?",
  "What has changed while something else stayed?",
  "What remains after the rest fades?",
  "What are you being pulled toward now?",
];

export function OriginIntroductionStep({
  introduction,
  onIntroductionChange,
  onFinish,
  onRecordingChange,
  voiceActive,
  mediaReady,
  busy,
}: {
  introduction: string;
  onIntroductionChange: (v: string) => void;
  onFinish: () => void;
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

  // Text present before dictation started, so a restart doesn't eat typing.
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

  async function handleStart() {
    baseTextRef.current = introRef.current.trim();
    setError(null);
    await speech.start();
  }

  async function handleFinishSpeaking() {
    await speech.finish();
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
    <OriginScrim className="pointer-events-auto relative flex w-full max-w-2xl flex-col gap-6 overflow-hidden p-0">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-px bg-[linear-gradient(to_bottom,transparent,var(--amber),var(--ice),transparent)] opacity-70"
      />
      <div className="relative flex flex-col gap-6 px-7 py-8 sm:px-9">
      <div className="flex flex-col gap-3">
        <p className="text-[10px] uppercase tracking-[0.28em] text-text-lo/70">
          Signal / in your own words
        </p>
        {voiceStarted ? (
          <MorphingText
            as="h1"
            texts={[
              "What keeps bringing you back?",
              "What are you following now?",
            ]}
            loop={false}
            holdSeconds={1.8}
            className="font-display text-3xl leading-tight text-text-hi sm:text-4xl [&>span]:text-left"
          />
        ) : (
          <div aria-hidden className="h-8 sm:h-9" />
        )}
        <p className="max-w-lg text-sm leading-relaxed text-text-lo">
          Tell TEMPO where the music began for you, what keeps returning in the
          work, and what feels alive right now. Don&rsquo;t explain everything—follow
          the details that still have energy.
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
            "Start with the part that still feels alive."
          }
          className="min-h-40 resize-none rounded-none border-0 bg-transparent px-0 text-base leading-relaxed shadow-none focus-visible:ring-0"
          aria-describedby="origin-intro-status origin-intro-privacy"
        />

        {/* Restrained live region: state changes, not every word heard. */}
        <p id="origin-intro-status" aria-live="polite" className="min-h-4 text-xs text-text-lo">
          {speech.transcribing
            ? "Writing down what you said…"
            : speech.listening
              ? `${speech.paused ? "Paused" : "Listening"} · ${formatElapsed(speech.elapsed)}`
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

      <div className="flex flex-wrap items-center gap-2">
        {canSpeak && !speech.listening ? (
          <Button type="button" variant="secondary" onClick={handleStart} disabled={speech.transcribing}>
            <Mic /> {introduction.trim() ? "Speak more" : "Speak"}
          </Button>
        ) : null}

        {speech.listening ? (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={speech.paused ? speech.resume : speech.pause}
            >
              {speech.paused ? <Play /> : <Pause />}
              {speech.paused ? "Resume" : "Pause"}
            </Button>
            <Button type="button" variant="secondary" onClick={handleFinishSpeaking}>
              <Square /> Stop
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={speech.restart}>
              <RotateCcw /> Start over
            </Button>
          </>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          onClick={handleContinue}
          disabled={busy || speech.listening || speech.transcribing}
          className="ml-auto rounded-full border border-line/80 bg-white/[0.035] px-5 text-text-hi hover:border-ice/50 hover:bg-ice/[0.06] hover:text-text-hi"
        >
          {waiting ? "One moment…" : "Let it take shape →"}
        </Button>
      </div>

      <p id="origin-intro-privacy" className="text-xs leading-relaxed text-text-lo/80">
        Your words are sent to be transcribed and interpreted. The recording itself is not
        kept. Nothing is published without your confirmation.
      </p>
      </div>
    </OriginScrim>
  );
}
