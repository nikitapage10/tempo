"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { OriginScrim } from "@/components/origin/origin-copy-layer";
import { useOriginScrollScrub } from "@/hooks/use-origin-scroll-scrub";
import type { ArtistOriginInterpretation } from "@/lib/origin/types";
import { cn } from "@/lib/utils";

/**
 * Frame 6 — the story, scrubbed by scrolling.
 *
 * A tall container scrolls normally while a sticky stage holds the video in
 * view; scroll position maps to the video's playhead. All content is ordinary
 * semantic HTML on a dark scrim — the video is decoration, and every word here
 * would still be readable and usable if it failed to load entirely.
 *
 * In static mode the same sections render stacked, with no sticky stage and no
 * scrubbing, which is a complete experience rather than a degraded one.
 */

/** Chapter boundaries as fractions of the scroll range — §20. */
export const CHAPTER_STOPS = [0, 0.18, 0.42, 0.66, 0.88];

const CHAPTER_TITLES = [
  "The first shape",
  "What came through",
  "Your creative compass",
  "The chapter you are opening",
  "The beginning",
];

/** Scroll distance per chapter. Enough to feel deliberate, not a marathon. */
const VH_PER_CHAPTER = 90;

function ChapterSection({
  index,
  active,
  staticMode,
  children,
}: {
  index: number;
  active: boolean;
  staticMode: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`origin-chapter-${index}`}
      className={cn(
        staticMode
          ? "py-12"
          : "transition-opacity duration-500 motion-reduce:transition-none",
        !staticMode && !active && "pointer-events-none opacity-0"
      )}
    >
      <OriginScrim className="mx-auto w-full max-w-2xl">
        <h2
          id={`origin-chapter-${index}`}
          className="text-xs uppercase tracking-[0.2em] text-text-lo"
        >
          {CHAPTER_TITLES[index]}
        </h2>
        <div className="mt-4">{children}</div>
      </OriginScrim>
    </section>
  );
}

export function OriginStoryScroll({
  interpretation,
  staticMode,
  videoRef,
  onEnter,
  onBack,
  busy,
  error,
  importPending,
  useForProfile,
  onUseForProfileChange,
}: {
  interpretation: ArtistOriginInterpretation;
  staticMode: boolean;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  onEnter: () => void;
  onBack: () => void;
  busy: boolean;
  error: string | null;
  importPending: boolean;
  useForProfile: boolean;
  onUseForProfileChange: (v: boolean) => void;
}) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);

  const { chapter } = useOriginScrollScrub({
    scrollerRef,
    videoRef,
    chapterStops: CHAPTER_STOPS,
    enabled: !staticMode,
  });

  /** Jump straight to the closing section. A safety valve: if scrubbing ever
   *  fails again, the way out must not be something you can only scroll to. */
  const skipToEnd = React.useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  const sections = [
    <p key="promise" className="font-display text-xl leading-relaxed text-text-hi sm:text-2xl">
      {interpretation.artistPromise || "A beginning, in your own words."}
    </p>,

    <ul key="signals" className="flex flex-col gap-4">
      {interpretation.identitySignals.map((s) => (
        <li key={s.label}>
          <h3 className="font-display text-base text-text-hi">{s.label}</h3>
          <p className="mt-1 text-sm leading-relaxed text-text-lo">{s.explanation}</p>
        </li>
      ))}
    </ul>,

    <p key="compass" className="text-sm leading-relaxed text-text-lo">
      {interpretation.creativeCompass}
    </p>,

    <div key="chapter">
      <h3 className="font-display text-lg text-text-hi">
        {interpretation.currentChapter.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-text-lo">
        {interpretation.currentChapter.premise}
      </p>
    </div>,

    <div key="final" className="flex flex-col gap-5">
      <p className="font-display text-xl text-text-hi">This can change as you do.</p>

      <label className="flex items-start gap-3 text-sm text-text-lo">
        <input
          type="checkbox"
          checked={useForProfile}
          onChange={(e) => onUseForProfileChange(e.target.checked)}
          className="mt-0.5 size-4 accent-[var(--ice)]"
        />
        <span>
          Use this as the beginning of my private artist profile.
          <span className="mt-1 block text-xs text-text-lo/70">
            Nothing is published. Your profile stays exactly as visible as it is now.
          </span>
        </span>
      </label>

      {error ? (
        <p role="alert" className="text-xs text-warn">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={onEnter} disabled={busy}>
          {busy ? "Saving…" : "Enter TEMPO"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onBack} disabled={busy}>
          Back
        </Button>
      </div>

      <p className="text-xs text-text-lo/70">
        {importPending
          ? "Next, TEMPO will help you bring your music in."
          : "Your workspace is ready when you are."}
      </p>
    </div>,
  ];

  if (staticMode) {
    return (
      <div className="relative z-10 mx-auto w-full max-w-3xl px-5 py-16">
        {sections.map((content, i) => (
          <ChapterSection key={i} index={i} active staticMode>
            {content}
          </ChapterSection>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={scrollerRef}
      // ORIGIN sits in a fixed full-screen stage, so the document never
      // scrolls — this element is the scroller, and the scrub hook reads its
      // scrollTop directly.
      className="absolute inset-0 z-10 overflow-y-auto overscroll-contain"
    >
      {/* The scroll range. The sticky child stays in view across all of it. */}
      <div style={{ height: `${sections.length * VH_PER_CHAPTER + 100}vh` }} className="w-full">
        <div className="sticky top-0 flex h-[100dvh] items-center justify-center px-5">
          {sections.map((content, i) => (
            <div
              key={i}
              className={cn("absolute inset-x-5", i !== chapter && "pointer-events-none")}
            >
              <ChapterSection index={i} active={i === chapter} staticMode={false}>
                {content}
              </ChapterSection>
            </div>
          ))}
        </div>
      </div>

      {/* Always reachable, whatever the scroll position. */}
      <div className="pointer-events-none sticky bottom-0 flex items-center justify-between gap-3 px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p
          aria-hidden
          className={cn(
            "text-xs text-text-lo/70 transition-opacity duration-500",
            chapter === 0 ? "opacity-100" : "opacity-0"
          )}
        >
          Scroll to read on
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={chapter === sections.length - 1 ? onEnter : skipToEnd}
          disabled={busy}
          className="pointer-events-auto bg-bg-0/70 text-text-lo backdrop-blur hover:text-text-hi"
        >
          {chapter === sections.length - 1 ? "Enter TEMPO" : "Skip to the end"}
        </Button>
      </div>
    </div>
  );
}
