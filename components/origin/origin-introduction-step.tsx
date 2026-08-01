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
  "What does the room sound like when it's working?",
  "What do you keep circling back to?",
  "What should it do to someone?",
  "What's the thing you haven't made yet?",
];

const PROMPT_ROTATE_MS = 9000;

export function OriginIntroductionStep({
  introduction,
  onIntroductionChange,
  onFinish,
  onRecordingChange,
  mediaReady,
  busy,
}: {
  introduction: string;
  onIntroductionChange: (v: string) => void;
  onFinish: () => void;
  onRecordingChange: (recording: boolean) => void;
  mediaReady: boolean;
  busy: boolean;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [attempted, setAttempted] = React.useState(false);
  const [promptIndex, setPromptIndex] = React.useState(0);

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

  React.useEffect(() => {
    const t = setInterval(
      () => setPromptIndex((i) => (i + 1) % PROMPTS.length),
      PROMPT_ROTATE_MS
    );
    return () => clearInterval(t);
  }, []);

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
    <OriginScrim className="pointer-events-auto flex w-full max-w-xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <MorphingText
          as="h1"
          texts={["Before the lights come up —", "tell me what I've found."]}
          loop={false}
          className="font-display text-2xl leading-snug text-text-hi sm:text-3xl [&>span]:text-left"
        />
        <p className="text-sm text-text-lo">
          Out loud is easier than it looks. Half a minute, or as long as it takes.
        </p>
      </div>

      {/* Suggestions, not required questions. */}
      <p
        key={promptIndex}
        className="text-sm italic text-text-lo/80 transition-opacity duration-500 motion-reduce:transition-none"
      >
        {PROMPTS[promptIndex]}
      </p>

      <div className="flex flex-col gap-2">
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
            canSpeak ? "Talk, or write it — either way it stays yours to edit." : "Write it here."
          }
          className="resize-none text-base leading-relaxed"
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
          onClick={handleContinue}
          disabled={busy || speech.listening || speech.transcribing}
          className="ml-auto"
        >
          {waiting ? "One moment…" : "That's me"}
        </Button>
      </div>

      <p id="origin-intro-privacy" className="text-xs leading-relaxed text-text-lo/80">
        Your words are sent to be transcribed and interpreted. The recording itself is not
        kept. Nothing is published without your confirmation.
      </p>
    </OriginScrim>
  );
}
