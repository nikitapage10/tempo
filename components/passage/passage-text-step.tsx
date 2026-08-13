"use client";

import * as React from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MorphingText } from "@/components/ui/morphing-text";
import { OriginScrim } from "@/components/origin/origin-copy-layer";

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
  continueLabel = "Continue",
  minChars = 1,
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
  continueLabel?: string;
  minChars?: number;
  maxChars?: number;
  busy: boolean;
}) {
  const [error, setError] = React.useState<string | null>(null);

  function handleContinue() {
    if (busy) return;
    if (value.trim().length < minChars) {
      setError("Say a little more before continuing.");
      return;
    }
    setError(null);
    onFinish();
  }

  return (
    <OriginScrim className="pointer-events-auto relative flex w-full max-w-2xl flex-col gap-6 overflow-hidden p-0">
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
            onChange={(e) => {
              onValueChange(e.target.value);
              if (error) setError(null);
            }}
            rows={5}
            maxLength={maxChars}
            placeholder={placeholder}
            className="min-h-32 resize-none rounded-none border-0 bg-transparent px-0 text-base leading-relaxed shadow-none focus-visible:ring-0"
          />
        </div>

        {error ? (
          <p role="alert" className="text-xs text-warn">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={handleContinue}
            disabled={busy}
            className="rounded-full border border-line/80 bg-white/[0.035] px-5 text-text-hi hover:border-ice/50 hover:bg-ice/[0.06] hover:text-text-hi"
          >
            {continueLabel}
          </Button>
        </div>
      </div>
    </OriginScrim>
  );
}
