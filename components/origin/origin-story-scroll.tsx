"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  Music4,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ImportExperience,
  type ImportStep,
} from "@/components/import/import-experience";
import { useOriginScrollScrub } from "@/hooks/use-origin-scroll-scrub";
import type {
  ArtistOriginInterpretation,
  OriginStorySection,
} from "@/lib/origin/types";
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
  "About the artist",
  "The sound",
  "Right now",
  "The story",
  "Bring the work into range",
  "Keep tuning",
];

const CHAPTER_KICKERS = ["About", "Sound", "Now", "Story", "Intake", "Arrival"];

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
 * Each chapter owns its scroll range outright, and hands over across one short
 * band at the seam.
 *
 * A chapter exits between `EXIT_AT` and the end of its own range; the next one
 * enters over the last `ENTER_BAND` of that same stretch. Both are ~10% of a
 * chapter, so the crossfade is a beat rather than an overlap — the previous
 * settings let a chapter start arriving 70% before its turn, which is how three
 * of them ended up stacked on screen at once.
 */
const EXIT_AT = 0.9;
const ENTER_BAND = 0.1;

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

function ChapterBackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-4 flex w-fit items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-text-lo transition-colors hover:text-text-hi"
    >
      <ChevronLeft className="size-3.5" /> Back
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
  onBack,
}: {
  index: number;
  staticMode: boolean;
  children: React.ReactNode;
  title?: string;
  wide?: boolean;
  alignClass?: string;
  onBack?: () => void;
}) {
  if (index === 0) {
    return (
      <section
        aria-labelledby="origin-chapter-0"
        className={cn(staticMode && "py-12")}
      >
        <div
          className={cn(
            "origin-first-shape relative w-full max-w-2xl overflow-hidden rounded-[28px] border border-line/70",
            "bg-[linear-gradient(120deg,rgb(10_10_12/0.9),rgb(20_24_31/0.72),rgb(10_10_12/0.84))] shadow-3 backdrop-blur-xl",
            alignClass ?? CHAPTER_ALIGN[index]
          )}
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-[4.5rem] w-px bg-[linear-gradient(to_bottom,transparent,var(--ice),var(--amber),transparent)] opacity-70"
          />
          <span
            aria-hidden
            className="absolute -right-24 -top-28 size-72 rounded-full border border-ice/10 bg-ice/[0.035]"
          />
          <div className="origin-first-shape__content relative grid grid-cols-[3rem_1fr] gap-6 px-6 py-7 sm:grid-cols-[3.5rem_1fr] sm:gap-8 sm:px-8 sm:py-9">
            <div className="flex flex-col items-center gap-3 pt-1 text-[10px] uppercase tracking-[0.22em] text-text-lo/60">
              <span className="font-mono text-ice">01</span>
              <span className="h-12 w-px bg-line" />
              <span className="[writing-mode:vertical-rl]">Origin</span>
            </div>
            <div>
              {onBack ? <ChapterBackButton onClick={onBack} /> : null}
              <h2
                id="origin-chapter-0"
                className="text-xs uppercase tracking-[0.26em] text-text-hi/85"
              >
                {title ?? CHAPTER_TITLES[index]}
              </h2>
              <div className="mt-5">{children}</div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby={`origin-chapter-${index}`}
      className={cn(staticMode && "py-12")}
    >
      {/* Middle-left, opposite the earlier steps: the scroll footage opens out
          from the right, so the copy sits on the quieter side of the frame. */}
      <div
        className={cn(
          "origin-story-chapter relative w-full overflow-hidden rounded-[26px] border bg-[linear-gradient(125deg,rgb(9_10_13/0.9),rgb(21_25_32/0.76),rgb(10_10_13/0.86))] shadow-3 backdrop-blur-xl",
          index % 2 === 0 ? "border-amber/25" : "border-ice/30",
          "transition-[max-width,transform] duration-700 motion-reduce:transition-none",
          wide ? "max-w-5xl" : "max-w-xl",
          alignClass ?? CHAPTER_ALIGN[index]
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute -right-20 -top-24 size-56 rounded-full border opacity-70",
            index % 2 === 0
              ? "border-amber/15 bg-amber/[0.025]"
              : "border-ice/15 bg-ice/[0.03]"
          )}
        />
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-transparent to-transparent",
            index % 2 === 0 ? "via-amber/70" : "via-ice/70"
          )}
        />
        <div className="relative grid grid-cols-[2.5rem_1fr] gap-5 px-6 py-7 sm:grid-cols-[3rem_1fr] sm:gap-7 sm:px-8 sm:py-8">
          <div className="flex flex-col items-center gap-3 pt-0.5 text-[9px] uppercase tracking-[0.2em] text-text-lo/70">
            <span className={cn("font-mono", index % 2 === 0 ? "text-amber" : "text-ice")}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="h-10 w-px bg-[linear-gradient(to_bottom,var(--line),transparent)]" />
            <span className="[writing-mode:vertical-rl]">{CHAPTER_KICKERS[index]}</span>
          </div>
          <div className="min-w-0">
            {onBack ? <ChapterBackButton onClick={onBack} /> : null}
            <h2
              id={`origin-chapter-${index}`}
              className="text-xs uppercase tracking-[0.24em] text-text-hi/90"
            >
              {title ?? CHAPTER_TITLES[index]}
            </h2>
            <div className="mt-5">{children}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function OriginStoryScroll({
  interpretation,
  onInterpretationChange,
  staticMode,
  videoRef,
  onEnter,
  onBackToDirection,
  busy,
  error,
  onSkipImport,
  onImportComplete,
  importChoice,
  importPending,
}: {
  interpretation: ArtistOriginInterpretation;
  onInterpretationChange: (interpretation: ArtistOriginInterpretation) => void;
  staticMode: boolean;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  onEnter: () => void;
  onBackToDirection: () => void;
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
  const [editingChapter, setEditingChapter] = React.useState<number | null>(null);

  const importTitle: Record<ImportStep, string> = {
    intake: "Bring your music in",
    processing: "Reading what you brought",
    review: "Shape the workspace",
    spotify: "Find your released music",
    confirm: "Before anything is added",
    done: "Your studio is ready",
  };
  const importAlign =
    importStep === "processing" || importStep === "spotify" || importStep === "confirm"
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
      // the stage on its own — every other chapter is taken off the screen
      // outright rather than left at whatever opacity the scroll had reached,
      // which is what put the compass quote underneath the import panel.
      if (importStarted) {
        const own = i === 4;
        el.style.opacity = own ? "1" : "0";
        el.style.transform = "translate3d(0, 0, 0) scale(1)";
        el.style.pointerEvents = own ? "auto" : "none";
        el.style.zIndex = own ? "40" : "0";
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
        // Approaching. The enter band is short and lands exactly where the
        // previous chapter's exit band ends, so at most two chapters are ever
        // on screen together and only across a narrow crossfade.
        const t = Math.max(0, 1 + local / ENTER_BAND);
        opacity = t;
        scale = 0.72 + 0.28 * t;
        x = -14 * (1 - t);
      } else if (local < EXIT_AT || isLast) {
        // Held. The closing chapter never leaves — "Enter TEMPO" must not be
        // something you can scroll past and lose.
        opacity = 1;
        scale = 1;
        x = 0;
      } else {
        // Passing the viewer: keeps growing as it goes by, rather than shrinking.
        const t = Math.min(1, (local - EXIT_AT) / (1 - EXIT_AT));
        opacity = 1 - t;
        scale = 1 + 0.6 * t;
        x = 10 * t;
      }

      const clamped = Math.max(0, Math.min(1, opacity));
      el.style.opacity = String(clamped);
      el.style.transform = `translate3d(${x}%, 0, 0) scale(${scale})`;
      // Only the chapter in focus should be clickable, and a chapter that is
      // all but invisible must never intercept a click meant for the one above.
      el.style.pointerEvents = clamped > 0.6 ? "auto" : "none";
      // Deterministic ordering for the brief moment two chapters coexist: the
      // later one is always the one arriving, so it belongs on top.
      el.style.zIndex = String(10 + i);
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

  const patchInterpretation = React.useCallback(
    (patch: Partial<ArtistOriginInterpretation>) => {
      onInterpretationChange({ ...interpretation, ...patch });
    },
    [interpretation, onInterpretationChange]
  );

  const goToChapter = React.useCallback(
    (target: number) => {
      const index = Math.max(0, Math.min(CHAPTER_STOPS.length - 1, target));
      setEditingChapter(null);
      if (staticMode) {
        document.getElementById(`origin-chapter-${index}`)?.scrollIntoView({ behavior: "smooth" });
        return;
      }
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const scrollable = scroller.scrollHeight - scroller.clientHeight;
      scroller.scrollTo({ top: CHAPTER_STOPS[index] * scrollable, behavior: "smooth" });
    },
    [staticMode]
  );

  function updateStorySection(index: number, patch: Partial<OriginStorySection>) {
    patchInterpretation({
      storySections: interpretation.storySections.map((section, sectionIndex) =>
        sectionIndex === index ? { ...section, ...patch } : section
      ),
    });
  }

  function moveStorySection(index: number, offset: -1 | 1) {
    const destination = index + offset;
    if (destination < 0 || destination >= interpretation.storySections.length) return;
    const sections = [...interpretation.storySections];
    [sections[index], sections[destination]] = [sections[destination], sections[index]];
    patchInterpretation({ storySections: sections });
  }

  const editAction = (index: number) => (
    <button
      type="button"
      onClick={() => setEditingChapter(editingChapter === index ? null : index)}
      className="flex w-fit items-center gap-1.5 text-xs text-ice transition-colors hover:text-text-hi"
    >
      <Pencil className="size-3.5" /> {editingChapter === index ? "Done editing" : "Edit"}
    </button>
  );

  const backForChapter = React.useCallback(
    (index: number) => {
      if (index === 0) {
        onBackToDirection();
        return;
      }
      if (index === 4 && importStarted) {
        setImportStarted(false);
        return;
      }
      goToChapter(index - 1);
    },
    [goToChapter, importStarted, onBackToDirection]
  );

  const sections = [
    <div key="about" className="flex flex-col gap-5">
      {editingChapter === 0 ? (
        <div className="grid gap-3">
          <Input
            value={interpretation.artistPromise}
            onChange={(event) => patchInterpretation({ artistPromise: event.target.value })}
            maxLength={140}
            placeholder="A concise line beneath your name"
            aria-label="Artist tagline"
            className="font-display text-lg"
          />
          <Textarea
            value={interpretation.creativeCompass}
            onChange={(event) => patchInterpretation({ creativeCompass: event.target.value })}
            maxLength={2000}
            rows={5}
            placeholder="Who you are and what music you make"
            aria-label="Artist introduction"
            className="resize-none"
          />
        </div>
      ) : (
        <>
          {interpretation.artistPromise ? (
            <p className="max-w-xl font-display text-2xl leading-snug text-text-hi sm:text-3xl">
              {interpretation.artistPromise}
            </p>
          ) : null}
          <p className="max-w-xl text-sm leading-7 text-text-hi/85">
            {interpretation.creativeCompass || "Add a concise introduction to the artist and the work."}
          </p>
        </>
      )}
      {editAction(0)}
    </div>,

    <div key="signals" className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {interpretation.identitySignals.map((signal, index) => (
          <div
            key={`signal-${index}`}
            className="relative overflow-hidden rounded-2xl border border-line/60 bg-white/[0.025] p-4"
          >
            {editingChapter === 1 ? (
              <div className="grid gap-2">
                <Input
                  value={signal.label}
                  onChange={(event) => {
                    const next = [...interpretation.identitySignals];
                    next[index] = { ...signal, label: event.target.value };
                    patchInterpretation({ identitySignals: next });
                  }}
                  maxLength={80}
                  aria-label={`Sound quality ${index + 1}`}
                />
                <Textarea
                  value={signal.explanation}
                  onChange={(event) => {
                    const next = [...interpretation.identitySignals];
                    next[index] = { ...signal, explanation: event.target.value };
                    patchInterpretation({ identitySignals: next });
                  }}
                  maxLength={600}
                  rows={3}
                  aria-label={`Sound description ${index + 1}`}
                  className="resize-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    patchInterpretation({
                      identitySignals: interpretation.identitySignals.filter((_, itemIndex) => itemIndex !== index),
                    })
                  }
                  className="flex w-fit items-center gap-1 text-xs text-text-lo hover:text-warn"
                >
                  <Trash2 className="size-3.5" /> Remove
                </button>
              </div>
            ) : (
              <>
                <span className="absolute right-3 top-2 font-mono text-[10px] text-ice/55">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="pr-7 font-display text-base text-text-hi">{signal.label}</h3>
                <p className="mt-2 text-sm leading-6 text-text-lo">{signal.explanation}</p>
              </>
            )}
          </div>
        ))}
      </div>
      {editingChapter === 1 && interpretation.identitySignals.length < 5 ? (
        <button
          type="button"
          onClick={() =>
            patchInterpretation({
              identitySignals: [
                ...interpretation.identitySignals,
                { label: "", explanation: "", evidence: "Added by the artist.", confidence: "high" },
              ],
            })
          }
          className="flex w-fit items-center gap-1 text-xs text-ice"
        >
          <Plus className="size-3.5" /> Add a sound quality
        </button>
      ) : null}
      {editAction(1)}
    </div>,

    <div key="now" className="flex flex-col gap-4">
      {editingChapter === 2 ? (
        <div className="grid gap-3">
          <Input
            value={interpretation.currentChapter.title}
            onChange={(event) =>
              patchInterpretation({
                currentChapter: { ...interpretation.currentChapter, title: event.target.value },
              })
            }
            maxLength={120}
            placeholder="What is happening now?"
            aria-label="Current focus title"
            className="font-display text-lg"
          />
          <Textarea
            value={interpretation.currentChapter.premise}
            onChange={(event) =>
              patchInterpretation({
                currentChapter: { ...interpretation.currentChapter, premise: event.target.value },
              })
            }
            maxLength={2000}
            rows={4}
            placeholder="The release, project, or direction taking shape"
            aria-label="Current focus description"
            className="resize-none"
          />
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-line/60 bg-white/[0.025] p-5">
          <h3 className="font-display text-2xl text-text-hi">
            {interpretation.currentChapter.title || "Add what is happening now"}
          </h3>
          <p className="mt-3 max-w-lg text-sm leading-7 text-text-hi/80">
            {interpretation.currentChapter.premise}
          </p>
          <span aria-hidden className="absolute -bottom-10 -right-8 size-28 rounded-full border border-amber/15" />
        </div>
      )}
      {editAction(2)}
    </div>,

    <div key="story" className="flex flex-col gap-4">
      {interpretation.storySections.map((section, index) => (
        <div key={`story-${index}`} className="rounded-2xl border border-line/60 bg-white/[0.025] p-4">
          {editingChapter === 3 ? (
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <Input
                  value={section.title}
                  onChange={(event) => updateStorySection(index, { title: event.target.value })}
                  maxLength={120}
                  placeholder="Section title"
                  aria-label={`Story section ${index + 1} title`}
                  className="font-display"
                />
                <button type="button" onClick={() => moveStorySection(index, -1)} disabled={index === 0} className="p-2 text-text-lo disabled:opacity-30" aria-label="Move story section up">
                  <ArrowUp className="size-3.5" />
                </button>
                <button type="button" onClick={() => moveStorySection(index, 1)} disabled={index === interpretation.storySections.length - 1} className="p-2 text-text-lo disabled:opacity-30" aria-label="Move story section down">
                  <ArrowDown className="size-3.5" />
                </button>
                <button type="button" onClick={() => patchInterpretation({ storySections: interpretation.storySections.filter((_, itemIndex) => itemIndex !== index) })} className="p-2 text-text-lo hover:text-warn" aria-label="Remove story section">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <Textarea
                value={section.body}
                onChange={(event) => updateStorySection(index, { body: event.target.value })}
                maxLength={2000}
                rows={4}
                placeholder="Write this part of the story in your own words"
                aria-label={`Story section ${index + 1} body`}
                className="resize-none"
              />
            </div>
          ) : (
            <>
              <p className="text-[10px] uppercase tracking-[0.22em] text-ice/70">
                {String(index + 1).padStart(2, "0")}
              </p>
              {section.title ? <h3 className="mt-2 font-display text-lg text-text-hi">{section.title}</h3> : null}
              <p className="mt-2 text-sm leading-7 text-text-lo">{section.body}</p>
            </>
          )}
        </div>
      ))}
      {!interpretation.storySections.length && editingChapter !== 3 ? (
        <p className="text-sm leading-7 text-text-lo">Add the parts of your story you want people to know.</p>
      ) : null}
      {editingChapter === 3 && interpretation.storySections.length < 8 ? (
        <button
          type="button"
          onClick={() => patchInterpretation({ storySections: [...interpretation.storySections, { title: "", body: "" }] })}
          className="flex w-fit items-center gap-1 text-xs text-ice"
        >
          <Plus className="size-3.5" /> Add a story section
        </button>
      ) : null}
      {editAction(3)}
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
            Finished records, abandoned versions, unfinished sessions, and new ideas
            all carry part of the signal. Bring in what already exists, and it will
            become part of the workspace waiting on the other side. Nothing is added
            until you approve it.
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
              {importPending ? "Begin with open space" : "Not now"}
            </Button>
          </div>
          {importChoice === "empty" ? (
            <p className="text-xs text-ice">
              Beginning with open space. You can bring music in any time from Settings.
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

    <div key="final" className="relative flex flex-col gap-5 pl-6">
      <span aria-hidden className="absolute inset-y-0 left-0 w-px bg-[linear-gradient(to_bottom,var(--ice),white,var(--amber),transparent)] shadow-[0_0_16px_var(--ice)]" />
      <p className="font-display text-xl leading-relaxed text-text-hi">
        A signal is never finished.
      </p>
      <p className="text-sm leading-relaxed text-text-lo">
        It changes with everything you make, every direction you follow, and every
        part of yourself you bring into the work.
      </p>
      <p className="text-sm leading-relaxed text-text-lo">
        You&rsquo;ve given it a name. You&rsquo;ve given it a history.
      </p>
      <p className="font-display text-lg leading-relaxed text-text-hi">
        Now give it somewhere to go.
      </p>

      {error ? (
        <p role="alert" className="text-xs text-warn">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <EnterTempoButton onClick={onEnter} busy={busy} />
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
            onBack={() => backForChapter(i)}
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
                onBack={() => backForChapter(i)}
              >
                {content}
                {i === 0 ? <ScrollCue /> : null}
              </ChapterSection>
            </div>
          ))}
        </div>
      </div>

      {/* The exit appears only once the viewer reaches the closing chapter. */}
      {chapter === sections.length - 1 ? (
        <div className="pointer-events-none sticky bottom-0 flex justify-end px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onEnter}
            disabled={busy}
            className="pointer-events-auto bg-bg-0/60 text-text-lo backdrop-blur hover:text-text-hi"
          >
            Enter TEMPO
          </Button>
        </div>
      ) : null}
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
