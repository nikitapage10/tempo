"use client";

import * as React from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MorphingText } from "@/components/ui/morphing-text";
import { OriginScrim } from "@/components/origin/origin-copy-layer";
import { PASSAGE_PANEL } from "@/components/passage/passage-panel";
import { cn } from "@/lib/utils";

/**
 * One open question, held on its own loop. Frames 3–5 of PASSAGE (entry,
 * support, function) all share this shape — only the copy and the field
 * change between them.
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
  /** False while the next clip is still buffering — see use-passage-media. */
  mediaReady?: boolean;
  continueLabel?: string;
  maxChars?: number;
  busy: boolean;
}) {
  /**
   * Nothing here is required. These are questions about a person, not a form
   * that has to validate — someone who would rather get on with the work can
   * pass any of them, and everything stays editable in Settings afterwards.
   */
  const answered = value.trim().length > 0;

  /**
   * Advancing waits on the destination clip rather than blocking the button:
   * the member's press is remembered and honoured the moment the film is
   * ready, so a slow connection reads as a beat rather than a dead control.
   */
  const [attempted, setAttempted] = React.useState(false);
  const waiting = attempted && !mediaReady;

  React.useEffect(() => {
    if (attempted && mediaReady) onFinish();
  }, [attempted, mediaReady, onFinish]);

  function handleContinue() {
    if (busy) return;
    setAttempted(true);
    if (mediaReady) onFinish();
  }

  return (
    <OriginScrim
      className={cn(
        "pointer-events-auto relative flex w-full max-w-2xl flex-col gap-6 overflow-hidden p-0",
        PASSAGE_PANEL
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-px bg-[linear-gradient(to_bottom,transparent,var(--amber),var(--ice),transparent)] opacity-70"
      />
      <div className="relative flex flex-col gap-6 px-7 py-8 sm:px-9">
        <button
          type="button"
          onClick={onBack}
          className="flex w-fit items-center gap-1 text-xs text-text-lo transition-colors hover:text-text-hi"
        >
          <ChevronLeft className="size-3.5" /> Back
        </button>
        <div className="flex flex-col gap-3">
          <p className="text-[11px] uppercase tracking-[0.28em] text-text-lo/70">{kicker}</p>
          <MorphingText
            as="h1"
            texts={[heading]}
            loop={false}
            className="font-display text-3xl leading-tight text-text-hi sm:text-4xl [&>span]:text-left"
          />
          <p className="max-w-lg text-sm leading-relaxed text-text-lo">{prompt}</p>
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
            className="min-h-32 resize-none rounded-none border-0 bg-transparent px-0 text-base leading-relaxed shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
            disabled={busy}
            className="ml-auto rounded-full border border-line/80 bg-white/[0.035] px-5 text-text-hi hover:border-ice/50 hover:bg-ice/[0.06] hover:text-text-hi"
          >
            {waiting ? "One moment…" : answered ? continueLabel : "Pass on this one"}
          </Button>
        </div>
      </div>
    </OriginScrim>
  );
}
