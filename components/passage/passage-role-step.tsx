"use client";

import * as React from "react";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MorphingText } from "@/components/ui/morphing-text";
import { OriginScrim } from "@/components/origin/origin-copy-layer";
import { PASSAGE_ROLE_CHIPS, PASSAGE_ROLE_OTHER } from "@/lib/passage/roles";
import { cn } from "@/lib/utils";

/** Frame 2 — who is joining, in their own words. */
export function PassageRoleStep({
  roleTitle,
  roleTitleOther,
  onRoleChange,
  onRoleOtherChange,
  onBack,
  onSubmit,
  onSkipAll,
  mediaReady = true,
  busy,
  active = true,
}: {
  roleTitle: string;
  roleTitleOther: string;
  onRoleChange: (v: string) => void;
  onRoleOtherChange: (v: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  /** Leaves the whole flow, not just this question. */
  onSkipAll?: () => void;
  /** False while the next clip is still buffering — see use-passage-media. */
  mediaReady?: boolean;
  busy: boolean;
  active?: boolean;
}) {
  const isOther = roleTitle === PASSAGE_ROLE_OTHER;
  const otherInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (active && isOther) {
      const t = setTimeout(() => otherInputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [active, isOther]);

  const canSubmit = isOther ? roleTitleOther.trim().length > 0 : roleTitle.trim().length > 0;

  /** Remembers the press and honours it once the next clip is ready. */
  const [attempted, setAttempted] = React.useState(false);
  const waiting = attempted && !mediaReady;

  React.useEffect(() => {
    if (attempted && mediaReady) onSubmit();
  }, [attempted, mediaReady, onSubmit]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !canSubmit) return;
    setAttempted(true);
    if (mediaReady) onSubmit();
  }

  return (
    <OriginScrim className="pointer-events-auto relative w-full max-w-lg overflow-hidden p-0 text-left">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-px bg-[linear-gradient(to_bottom,transparent,var(--ice),var(--amber),transparent)] opacity-80 shadow-[0_0_24px_var(--ice)]"
      />
      <span
        aria-hidden
        className="absolute -right-16 -top-20 size-56 rounded-full border border-ice/10 bg-ice/[0.035] blur-sm"
      />

      <form
        onSubmit={handleSubmit}
        className="relative flex flex-col gap-7 px-7 py-8 sm:px-9 sm:py-10"
      >
        <div className="flex items-center justify-between gap-4 text-[11px] uppercase tracking-[0.28em] text-text-lo/70">
          <span>Passage / 01</span>
          <span className="h-px flex-1 bg-[linear-gradient(90deg,var(--line),transparent)]" />
          <span>In your words</span>
        </div>

        <div className="flex flex-col gap-3">
          <MorphingText
            as="h1"
            texts={["What best describes you?"]}
            loop={false}
            className="font-display text-3xl leading-tight text-text-hi sm:text-4xl [&>span]:text-left"
          />
          <p className="max-w-sm text-sm leading-relaxed text-text-lo">
            Pick whichever fits, or write your own.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {PASSAGE_ROLE_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => onRoleChange(chip)}
              aria-pressed={roleTitle === chip}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                roleTitle === chip
                  ? "border-ice/70 bg-ice/10 text-text-hi"
                  : "border-line/70 bg-white/[0.02] text-text-lo hover:border-ice/40 hover:text-text-hi"
              )}
            >
              {chip}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onRoleChange(PASSAGE_ROLE_OTHER)}
            aria-pressed={isOther}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              isOther
                ? "border-amber/70 bg-amber/10 text-text-hi"
                : "border-line/70 bg-white/[0.02] text-text-lo hover:border-amber/40 hover:text-text-hi"
            )}
          >
            {PASSAGE_ROLE_OTHER}
          </button>
        </div>

        {isOther ? (
          <div className="relative flex flex-col gap-2 border-b border-line/80 pb-2 focus-within:border-amber/70">
            <label htmlFor="passage-role-other" className="sr-only">
              Describe your role
            </label>
            <Input
              id="passage-role-other"
              ref={otherInputRef}
              value={roleTitleOther}
              onChange={(e) => onRoleOtherChange(e.target.value)}
              placeholder="Your role in the industry"
              autoComplete="off"
              maxLength={120}
              className="h-auto rounded-none border-0 bg-transparent px-0 py-2 font-display text-xl tracking-[0.01em] text-text-hi shadow-none placeholder:tracking-normal focus-visible:ring-0"
            />
          </div>
        ) : null}

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
            disabled={busy || !canSubmit}
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
