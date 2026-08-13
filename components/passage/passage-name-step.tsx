"use client";

import * as React from "react";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MorphingText } from "@/components/ui/morphing-text";
import { OriginScrim } from "@/components/origin/origin-copy-layer";
import {
  PASSAGE_PANEL,
  PASSAGE_PANEL_TOP_EDGE,
} from "@/components/passage/passage-panel";
import { cn } from "@/lib/utils";

/** Frame 2 of PASSAGE. Their name, before anything else is asked. */
export function PassageNameStep({
  name,
  onNameChange,
  onBack,
  onSubmit,
  onSkipAll,
  mediaReady = true,
  busy,
  active = true,
}: {
  name: string;
  onNameChange: (v: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  onSkipAll?: () => void;
  mediaReady?: boolean;
  busy: boolean;
  active?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(t);
  }, [active]);

  const [attempted, setAttempted] = React.useState(false);
  const waiting = attempted && !mediaReady;

  React.useEffect(() => {
    if (attempted && mediaReady) onSubmit();
  }, [attempted, mediaReady, onSubmit]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !name.trim()) return;
    setAttempted(true);
    if (mediaReady) onSubmit();
  }

  return (
    <OriginScrim
      className={cn(
        "pointer-events-auto relative w-full max-w-lg overflow-hidden p-0 text-left",
        PASSAGE_PANEL
      )}
    >
      <span aria-hidden className={PASSAGE_PANEL_TOP_EDGE} />
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-px bg-[linear-gradient(to_bottom,transparent,var(--ice),var(--amber),transparent)] opacity-80 shadow-[0_0_24px_var(--ice)]"
      />

      <form
        onSubmit={handleSubmit}
        className="relative flex flex-col gap-8 px-7 py-8 sm:px-9 sm:py-10"
      >
        <div className="flex items-center justify-between gap-4 text-[11px] uppercase tracking-[0.28em] text-text-lo/70">
          <span>Passage / 01</span>
          <span className="h-px flex-1 bg-[linear-gradient(90deg,var(--line),transparent)]" />
          <span>Your name</span>
        </div>

        <div className="flex flex-col gap-3">
          <MorphingText
            as="h1"
            texts={["What should we call you?"]}
            loop={false}
            className="font-display text-4xl leading-none text-text-hi sm:text-5xl [&>span]:text-left"
          />
          <p className="max-w-sm text-sm leading-relaxed text-text-lo">
            The name the artists you work with would know you by.
          </p>
        </div>

        <div className="relative flex flex-col gap-2 border-b border-line/80 pb-2 focus-within:border-ice/70">
          <label htmlFor="passage-name" className="sr-only">
            Your name
          </label>
          <Input
            id="passage-name"
            ref={inputRef}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            maxLength={60}
            className="h-auto rounded-none border-0 bg-transparent px-0 py-2 font-display text-2xl tracking-[0.03em] text-text-hi shadow-none placeholder:tracking-normal focus-visible:ring-0 sm:text-3xl"
          />
          <span
            aria-hidden
            className="absolute bottom-[-1px] left-0 h-px w-16 bg-ice shadow-[0_0_12px_var(--ice)]"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 text-xs text-text-lo transition-colors hover:text-text-hi"
            >
              <ChevronLeft className="size-3.5" /> Back
            </button>
            {onSkipAll ? (
              <button
                type="button"
                onClick={onSkipAll}
                disabled={busy}
                className="text-xs text-text-lo transition-colors hover:text-text-hi disabled:opacity-60"
              >
                Skip for now
              </button>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="group flex items-center gap-3 rounded-full border border-line/80 bg-white/[0.035] py-1.5 pl-4 pr-1.5 text-sm text-text-hi transition-colors hover:border-ice/50 hover:bg-ice/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>{waiting ? "One moment…" : "Continue"}</span>
            <span className="flex size-9 items-center justify-center rounded-full bg-ice text-bg-0 transition-transform group-hover:translate-x-0.5">
              <ArrowRight className="size-4" />
            </span>
          </button>
        </div>
      </form>
    </OriginScrim>
  );
}
