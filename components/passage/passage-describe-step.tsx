"use client";

import * as React from "react";
import { ArrowRight, Check, ChevronLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
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
import { PASSAGE_ROLE_CHIPS } from "@/lib/passage/roles";
import { cn } from "@/lib/utils";

/**
 * Frame 3 of PASSAGE. What they are, as many answers as apply.
 *
 * Multi-select on purpose: the same person is routinely a manager and a label
 * owner, or a creative director who also shoots. Forcing one chip would make
 * most people pick the least interesting true thing about themselves.
 */
export function PassageDescribeStep({
  selected,
  other,
  onToggle,
  onOtherChange,
  onBack,
  onSubmit,
  onSkipAll,
  mediaReady = true,
  busy,
}: {
  selected: string[];
  other: string;
  onToggle: (role: string) => void;
  onOtherChange: (v: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  onSkipAll?: () => void;
  mediaReady?: boolean;
  busy: boolean;
}) {
  const [attempted, setAttempted] = React.useState(false);
  const waiting = attempted && !mediaReady;
  const chosen = selected.length > 0 || other.trim().length > 0;

  React.useEffect(() => {
    if (attempted && mediaReady) onSubmit();
  }, [attempted, mediaReady, onSubmit]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setAttempted(true);
    if (mediaReady) onSubmit();
  }

  return (
    <OriginScrim
      className={cn(
        "pointer-events-auto relative flex w-full max-w-xl flex-col overflow-hidden p-0 text-left",
        ORIGIN_FIT_SHELL,
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
        className="relative flex min-h-0 flex-1 flex-col"
      >
      <div className={cn(ORIGIN_FIT_BODY, "flex flex-col gap-6 px-7 py-8 sm:px-9 sm:py-10")}>
        <div className="flex items-center justify-between gap-4 text-[11px] uppercase tracking-[0.28em] text-text-lo/70">
          <span>Passage / 02</span>
          <span className="h-px flex-1 bg-[linear-gradient(90deg,var(--line),transparent)]" />
          <span>What you are</span>
        </div>

        <div className="flex flex-col gap-3">
          <MorphingText
            as="h1"
            texts={["What describes you?"]}
            loop={false}
            className="font-display text-3xl leading-tight text-text-hi sm:text-4xl [&>span]:text-left"
          />
          <p className="max-w-md text-sm leading-relaxed text-text-lo">
            Pick as many as fit. Most people wear more than one hat.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {PASSAGE_ROLE_CHIPS.map((chip) => {
            const on = selected.includes(chip);
            return (
              <button
                key={chip}
                type="button"
                onClick={() => onToggle(chip)}
                aria-pressed={on}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                  on
                    ? "border-ice/70 bg-ice/10 text-text-hi"
                    : "border-line/70 bg-white/[0.02] text-text-lo hover:border-ice/40 hover:text-text-hi"
                )}
              >
                {on ? <Check className="size-3.5 text-ice" /> : null}
                {chip}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 border-t border-line/50 pt-4">
          <label
            htmlFor="passage-role-other"
            className="font-mono text-[11px] uppercase tracking-wider text-text-lo"
          >
            Anything else
          </label>
          <Input
            id="passage-role-other"
            value={other}
            onChange={(e) => onOtherChange(e.target.value)}
            placeholder="In your own words"
            autoComplete="off"
            maxLength={120}
            className="h-auto rounded-none border-0 border-b border-line/70 bg-transparent px-0 py-2 text-base text-text-hi shadow-none focus-visible:border-amber/70 focus-visible:ring-0"
          />
        </div>
      </div>

      <div className={ORIGIN_FIT_FOOTER}>
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
            disabled={busy}
            className="group flex items-center gap-3 rounded-full border border-line/80 bg-white/[0.035] py-1.5 pl-4 pr-1.5 text-sm text-text-hi transition-colors hover:border-ice/50 hover:bg-ice/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice disabled:opacity-60"
          >
            <span>
              {waiting ? "One moment…" : chosen ? "Continue" : "Pass on this one"}
            </span>
            <span className="flex size-9 items-center justify-center rounded-full bg-ice text-bg-0 transition-transform group-hover:translate-x-0.5">
              <ArrowRight className="size-4" />
            </span>
          </button>
        </div>
      </div>
      </form>
    </OriginScrim>
  );
}
