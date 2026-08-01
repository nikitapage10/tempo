"use client";

import * as React from "react";
import { Music4 } from "lucide-react";
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
export const CHAPTER_STOPS = [0, 0.16, 0.34, 0.52, 0.72, 0.88];

const CHAPTER_TITLES = [
  "The first shape",
  "What came through",
  "Your creative compass",
  "The chapter you are opening",
  "Bring your music in",
  "Your story has a tempo",
];

/**
 * Where each chapter sits horizontally.
 *
 * The opening shape reads best just left of centre against the footage;
 * everything after it settles dead centre. A translate rather than a margin —
 * with `mx-auto` in play, overriding one side's margin pushes the block the
 * *opposite* way to what you'd expect.
 */
const CHAPTER_ALIGN = [
  "sm:-translate-x-[10%]",
  "",
  "",
  "",
  "",
  "",
];

/** Scroll distance per chapter. Enough to feel deliberate, not a marathon. */
const VH_PER_CHAPTER = 90;

/**
 * The one button in ORIGIN that should feel like an event.
 *
 * A slow ice→amber sweep runs across the fill, the flare-line motif sits under
 * the label, and the whole thing lifts on hover. Both signature hues appear
 * here deliberately — this is the single terminal action on the screen, so
 * there is no competing CTA for amber to be confused with.
 */
function EnterTempoButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(
        "group relative isolate overflow-hidden rounded-full px-8 py-3.5",
        "font-display text-base tracking-wide text-bg-0",
        "shadow-2 transition-transform duration-300 ease-out",
        "hover:-translate-y-0.5 hover:shadow-3 active:translate-y-0",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        "disabled:cursor-wait disabled:opacity-70 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      )}
    >
      <span
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,var(--ice),#ffffff_45%,var(--amber))] bg-[length:220%_100%] bg-[position:0%_0] transition-[background-position] duration-[1400ms] ease-out group-hover:bg-[position:100%_0] motion-reduce:transition-none"
      />
      <span className="relative">{busy ? "Opening…" : "Enter TEMPO"}</span>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-6 bottom-1.5 h-px bg-[linear-gradient(90deg,transparent,rgba(10,10,12,0.5),transparent)] opacity-0 transition-opacity duration-500 group-hover:opacity-100 motion-reduce:transition-none"
      />
    </button>
  );
}

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
      <OriginScrim className={cn("mx-auto w-full max-w-2xl", CHAPTER_ALIGN[index])}>
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
  onOpenImport,
  onSkipImport,
  importChoice,
}: {
  interpretation: ArtistOriginInterpretation;
  staticMode: boolean;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  onEnter: () => void;
  onBack: () => void;
  busy: boolean;
  error: string | null;
  onOpenImport: () => void;
  onSkipImport: () => void;
  /** Which way the artist went on the import chapter, once they've chosen. */
  importChoice: "imported" | "empty" | null;
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

    // Import lives inside the story rather than as a page you get sent to, so
    // the onboarding never breaks character. Skipping is fine — it stays under
    // Settings afterwards.
    <div key="import" className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-text-lo">
        Whatever you already have — a spreadsheet, screenshots of project folders, a
        voice note, a list in your phone — TEMPO can read it and propose a workspace.
        Nothing is added until you approve it.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" onClick={onOpenImport} disabled={busy}>
          <Music4 /> Bring my music in
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onSkipImport} disabled={busy}>
          Start empty
        </Button>
      </div>
      {importChoice === "empty" ? (
        <p className="text-xs text-ice">
          Starting empty. You can bring music in any time from Settings.
        </p>
      ) : null}
      {importChoice === "imported" ? (
        <p className="text-xs text-ice">Your workspace is built. It&rsquo;s waiting for you.</p>
      ) : null}
    </div>,

    <div key="final" className="flex flex-col gap-5">
      <p className="font-display text-xl leading-relaxed text-text-hi">
        This is where it starts keeping time with you.
      </p>
      <p className="text-sm leading-relaxed text-text-lo">
        None of it is fixed. Your story changes as you do, and TEMPO changes with it.
      </p>

      {error ? (
        <p role="alert" className="text-xs text-warn">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <EnterTempoButton onClick={onEnter} busy={busy} />
        <Button type="button" variant="ghost" size="sm" onClick={onBack} disabled={busy}>
          Back
        </Button>
      </div>
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
