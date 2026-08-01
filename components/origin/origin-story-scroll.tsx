"use client";

import * as React from "react";
import { Music4 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ImportExperience,
  type ImportStep,
} from "@/components/import/import-experience";
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
const CHAPTER_ALIGN = ["sm:ml-[8%]", "sm:ml-[8%]", "sm:ml-[8%]", "sm:ml-[8%]", "sm:ml-[8%]", "sm:ml-[8%]"];

/** Scroll distance per chapter. Enough to feel deliberate, not a marathon. */
const VH_PER_CHAPTER = 150;

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
  staticMode,
  children,
  title,
  wide = false,
  alignClass,
}: {
  index: number;
  staticMode: boolean;
  children: React.ReactNode;
  title?: string;
  wide?: boolean;
  alignClass?: string;
}) {
  return (
    <section
      aria-labelledby={`origin-chapter-${index}`}
      className={cn(staticMode && "py-12")}
    >
      {/* Middle-left, opposite the earlier steps: the scroll footage opens out
          from the right, so the copy sits on the quieter side of the frame. */}
      <OriginScrim
        tone="story"
        className={cn(
          "w-full transition-[max-width,transform] duration-700 motion-reduce:transition-none",
          wide ? "max-w-5xl" : "max-w-xl",
          alignClass ?? CHAPTER_ALIGN[index]
        )}
      >
        <h2
          id={`origin-chapter-${index}`}
          className="text-xs uppercase tracking-[0.2em] text-text-hi"
        >
          {title ?? CHAPTER_TITLES[index]}
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
  onSkipImport,
  onImportComplete,
  importChoice,
  importPending,
}: {
  interpretation: ArtistOriginInterpretation;
  staticMode: boolean;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  onEnter: () => void;
  onBack: () => void;
  busy: boolean;
  error: string | null;
  onSkipImport: () => void;
  onImportComplete: () => void;
  /** Which way the artist went on the import chapter, once they've chosen. */
  importChoice: "imported" | "empty" | null;
  importPending: boolean;
}) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const sectionRefs = React.useRef<Array<HTMLDivElement | null>>([]);
  const [importStarted, setImportStarted] = React.useState(false);
  const [importStep, setImportStep] = React.useState<ImportStep>("intake");

  const importTitle: Record<ImportStep, string> = {
    intake: "Bring your music in",
    processing: "Reading what you brought",
    review: "Shape the workspace",
    confirm: "Before anything is added",
    done: "Your studio is ready",
  };
  const importAlign =
    importStep === "processing" || importStep === "confirm"
      ? "sm:ml-auto sm:mr-[4%]"
      : "sm:ml-[4%]";

  /**
   * Drive each chapter's transform straight from scroll progress.
   *
   * The scroll footage travels down a tunnel, so the panels move with it:
   * each one arrives small from the left, resolves as it reaches its own stop,
   * then scales past the viewer as the next takes over. Blur stays on the
   * glass panel itself so its backdrop sampling remains intact.
   *
   * Written imperatively inside the scrub loop — routing per-frame transforms
   * through React state would re-render the whole story on every scroll tick.
   */
  const paint = React.useCallback((progress: number) => {
    const stops = CHAPTER_STOPS;
    sectionRefs.current.forEach((el, i) => {
      if (!el) return;
      // Import is an interaction, not another scroll beat. Once opened it owns
      // the stage at full clarity until the artist completes or dismisses it.
      if (i === 4 && importStarted) {
        el.style.opacity = "1";
        el.style.transform = "translate3d(0, 0, 0) scale(1)";
        el.style.pointerEvents = "auto";
        return;
      }
      const start = stops[i];
      const end = i + 1 < stops.length ? stops[i + 1] : 1;
      const span = Math.max(0.0001, end - start);
      // -1 well before its turn, 0 dead centre on it, +1 once it has passed.
      const local = (progress - start) / span;

      const isLast = i === stops.length - 1;

      let opacity: number;
      let scale: number;
      let x: number;
      if (local < 0) {
        // Approaching: small and out on the left, growing as it nears.
        const t = Math.max(0, 1 + local * 1.4);
        opacity = t;
        scale = 0.62 + 0.38 * t;
        x = -18 * (1 - t);
      } else if (local < 0.72 || isLast) {
        // Held. The closing chapter never leaves — "Enter TEMPO" must not be
        // something you can scroll past and lose.
        opacity = 1;
        scale = 1;
        x = 0;
      } else {
        // Passing the viewer: keeps growing as it goes by, rather than shrinking.
        const t = Math.min(1, (local - 0.72) / 0.28);
        opacity = 1 - t;
        scale = 1 + 0.75 * t;
        x = 12 * t;
      }

      el.style.opacity = String(Math.max(0, Math.min(1, opacity)));
      el.style.transform = `translate3d(${x}%, 0, 0) scale(${scale})`;
      // Only the chapter in focus should be clickable.
      el.style.pointerEvents = opacity > 0.6 ? "auto" : "none";
    });
  }, [importStarted]);

  const { chapter, progressRef } = useOriginScrollScrub({
    scrollerRef,
    videoRef,
    chapterStops: CHAPTER_STOPS,
    enabled: !staticMode,
    onProgress: paint,
  });

  /** Keep the embedded Import fully present without requiring a second outer
   * scroll gesture. Its own long content remains independently scrollable. */
  React.useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    if (importStarted) {
      const scrollable = scroller.scrollHeight - scroller.clientHeight;
      scroller.scrollTo({ top: CHAPTER_STOPS[4] * scrollable, behavior: "auto" });
    }
    paint(progressRef.current);
  }, [importStarted, paint, progressRef]);

  /**
   * Fade the opening chapter up once, then hand control to `paint`.
   *
   * The CSS transition set inline is cleared at the same time — from here on
   * opacity is written every frame from scroll position, and a transition on
   * top of that would lag the scrub.
   */
  React.useEffect(() => {
    if (staticMode) return;
    const el = sectionRefs.current[0];
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      el.style.opacity = "1";
    });
    const t = setTimeout(() => {
      sectionRefs.current.forEach((s) => {
        if (s) s.style.transition = "none";
      });
    }, 560);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [staticMode]);

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
      {importStarted ? (
        <div className="no-scrollbar max-h-[72dvh] overflow-y-auto overscroll-contain pr-1">
          <ImportExperience
            embedded
            onStepChange={setImportStep}
            onComplete={() => {
              onImportComplete();
              setImportStarted(false);
            }}
            onDiscard={() => {
              onSkipImport();
              setImportStarted(false);
            }}
          />
        </div>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-text-lo">
            Whatever you already have — a spreadsheet, screenshots of project folders,
            a voice note, a list in your phone — TEMPO can read it and propose a
            workspace. Nothing is added until you approve it.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setImportStarted(true)}
              disabled={busy}
            >
              <Music4 /> Bring my music in
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSkipImport}
              disabled={busy}
            >
              {importPending ? "Start empty" : "Not now"}
            </Button>
          </div>
          {importChoice === "empty" ? (
            <p className="text-xs text-ice">
              Starting empty. You can bring music in any time from Settings.
            </p>
          ) : null}
          {importChoice === "imported" ? (
            <p className="text-xs text-ice">
              Your workspace is built. It&rsquo;s waiting for you.
            </p>
          ) : null}
        </>
      )}
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
      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 py-16">
        {sections.map((content, i) => (
          <ChapterSection
            key={i}
            index={i}
            staticMode
            title={i === 4 && importStarted ? importTitle[importStep] : undefined}
            wide={i === 4 && importStarted}
            alignClass={i === 4 && importStarted ? importAlign : undefined}
          >
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
      // scrollTop directly. The bar itself is hidden: it would cut a hard line
      // down the film.
      className={cn(
        "no-scrollbar absolute inset-0 z-10 overscroll-contain",
        importStarted ? "overflow-y-hidden" : "overflow-y-auto"
      )}
    >
      {/* The scroll range. The sticky child stays in view across all of it. */}
      <div style={{ height: `${sections.length * VH_PER_CHAPTER + 100}vh` }} className="w-full">
        <div className="sticky top-0 flex h-[100dvh] items-center px-5">
          {sections.map((content, i) => (
            <div
              key={i}
              ref={(el) => {
                sectionRefs.current[i] = el;
              }}
              // Transforms are written by `paint` on every scroll frame. The
              // first chapter starts at zero and is faded up by the mount
              // effect below, so the story opens rather than appearing.
              className="absolute inset-x-5 will-change-[transform,opacity]"
              style={{ opacity: 0, transition: "opacity 520ms ease-out" }}
            >
              <ChapterSection
                index={i}
                staticMode={false}
                title={i === 4 && importStarted ? importTitle[importStep] : undefined}
                wide={i === 4 && importStarted}
                alignClass={i === 4 && importStarted ? importAlign : undefined}
              >
                {content}
                {i === 0 ? <ScrollCue /> : null}
              </ChapterSection>
            </div>
          ))}
        </div>
      </div>

      {/* Always reachable, whatever the scroll position — the way out must
          never be something you can only reach by scrolling. */}
      <div className="pointer-events-none sticky bottom-0 flex justify-end px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={chapter === sections.length - 1 ? onEnter : skipToEnd}
          disabled={busy}
          className="pointer-events-auto bg-bg-0/60 text-text-lo backdrop-blur hover:text-text-hi"
        >
          {chapter === sections.length - 1 ? "Enter TEMPO" : "Skip to the end"}
        </Button>
      </div>
    </div>
  );
}

/** A small breathing cue under the opening chapter, in place of a footer label. */
function ScrollCue() {
  return (
    <div aria-hidden className="mt-6 flex items-center gap-2 text-xs text-text-lo/70">
      <span className="relative flex h-6 w-4 items-start justify-center rounded-full border border-line/80">
        <span className="mt-1 block h-1.5 w-0.5 rounded-full bg-ice motion-safe:animate-[origin-scroll-cue_1.8s_ease-in-out_infinite]" />
      </span>
      Scroll
    </div>
  );
}
