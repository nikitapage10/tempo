"use client";

import * as React from "react";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MorphingText } from "@/components/ui/morphing-text";
import { OriginScrim } from "@/components/origin/origin-copy-layer";
import { validateDirection } from "@/lib/origin/validation";

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
}: {
  direction: string;
  onDirectionChange: (value: string) => void;
  onBack: () => void;
  onFinish: () => void;
  busy: boolean;
}) {
  const [error, setError] = React.useState<string | null>(null);

  function handleContinue() {
    if (busy) return;
    const result = validateDirection(direction);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    onFinish();
  }

  return (
    <OriginScrim className="pointer-events-auto relative flex w-full max-w-2xl flex-col gap-6 overflow-hidden p-0">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-px bg-[linear-gradient(to_bottom,transparent,var(--ice),var(--amber),transparent)] opacity-75"
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
          <p className="text-[10px] uppercase tracking-[0.28em] text-text-lo/70">
            Direction / 02
          </p>
          <MorphingText
            as="h1"
            texts={["Your history gave the signal a source…", "Now, where are you taking it?"]}
            loop={false}
            holdSeconds={2}
            className="font-display text-3xl leading-tight text-text-hi sm:text-4xl [&>span]:text-left"
          />
          <p className="max-w-xl text-sm leading-relaxed text-text-lo">
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
            className="text-sm italic text-text-lo/85 [&>span]:text-left"
          />
        </div>

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
          className="min-h-36 resize-none rounded-none border-x-0 border-t-0 bg-transparent px-0 text-base leading-relaxed shadow-none focus-visible:ring-0"
        />

        {error ? <p role="alert" className="text-xs text-warn">{error}</p> : null}

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={handleContinue}
            disabled={busy}
            className="rounded-full px-5"
          >
            Set the direction <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </OriginScrim>
  );
}
