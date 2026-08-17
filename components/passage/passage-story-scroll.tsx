"use client";

import * as React from "react";
import { ArrowDown, ChevronLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useOriginScrollScrub } from "@/hooks/use-origin-scroll-scrub";
import type { PassageInterpretation } from "@/lib/passage/types";
import { cn } from "@/lib/utils";

/**
 * The closing scroll, scrubbed by scrolling. Same mechanism as
 * components/origin/origin-story-scroll.tsx.
 *
 * What it shows is written by TEMPO from the answers rather than echoed back,
 * and every word of it is editable here before it is kept. If the writing
 * failed or the account had nothing to write from, the member's own answers
 * stand in, so the ending is never blank.
 */

const CHAPTER_KICKERS = ["Welcome", "Story", "Arrival"];
/** Welcome, the story, and the way in. Fixed, so the stops can be too. */
const CHAPTER_STOPS = [0, 0.34, 0.67];
const VH_PER_CHAPTER = 130;
const EXIT_AT = 0.9;
const ENTER_BAND = 0.1;

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
    </button>
  );
}

function ChapterSection({
  index,
  title,
  staticMode,
  children,
  onBack,
}: {
  index: number;
  title: string;
  staticMode: boolean;
  children: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <section aria-labelledby={`passage-chapter-${index}`} className={cn(staticMode && "py-12")}>
      <div
        className={cn(
          "origin-story-chapter relative ml-0 flex w-full max-w-2xl flex-col overflow-hidden rounded-[26px] border shadow-3 backdrop-blur-2xl sm:ml-[6%]",
          // Dense enough to carry body copy over the film's bright streaks.
          "bg-[linear-gradient(125deg,rgb(9_10_13/0.94),rgb(18_21_27/0.9),rgb(10_10_13/0.94))]",
          !staticMode &&
            "max-h-[min(calc((100dvh-5rem)/var(--origin-zoom,1)),52rem)]",
          index % 2 === 0 ? "border-amber/25" : "border-ice/30"
        )}
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute -right-20 -top-24 size-56 rounded-full border opacity-70",
            index % 2 === 0 ? "border-amber/15 bg-amber/[0.025]" : "border-ice/15 bg-ice/[0.03]"
          )}
        />
        <div className="relative grid min-h-0 flex-1 grid-cols-[2.5rem_1fr] grid-rows-[minmax(0,1fr)] gap-5 overflow-hidden px-6 py-7 sm:grid-cols-[3rem_1fr] sm:gap-7 sm:px-8 sm:py-8">
          <div className="flex flex-col items-center gap-3 pt-0.5 text-[10px] uppercase tracking-[0.2em] text-text-lo/70">
            <span className={cn("font-mono", index % 2 === 0 ? "text-amber" : "text-ice")}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="h-10 w-px bg-[linear-gradient(to_bottom,var(--line),transparent)]" />
            <span className="[writing-mode:vertical-rl]">
              {CHAPTER_KICKERS[Math.min(index, CHAPTER_KICKERS.length - 1)]}
            </span>
          </div>
          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="mb-2 flex w-fit items-center gap-1 text-xs uppercase tracking-[0.16em] text-text-lo transition-colors hover:text-text-hi"
              >
                <ChevronLeft className="size-3.5" /> Back
              </button>
            ) : null}
            <h2
              id={`passage-chapter-${index}`}
              className="shrink-0 text-xs uppercase tracking-[0.24em] text-text-hi/90"
            >
              {title}
            </h2>
            <div
              className={cn(
                staticMode
                  ? "mt-5"
                  : "mt-5 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-auto pr-1 spectra-scrollbar"
              )}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PassageStoryScroll({
  displayName,
  roles,
  interpretation,
  onInterpretationChange,
  fallbackAnswers,
  staticMode,
  videoRef,
  onEnter,
  onBackToLook,
  busy,
  error,
}: {
  displayName: string;
  roles: string[];
  interpretation: PassageInterpretation;
  onInterpretationChange: (next: PassageInterpretation) => void;
  /** Shown when TEMPO had nothing to write, so the ending is never blank. */
  fallbackAnswers: { entry: string; supports: string; work: string };
  staticMode: boolean;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  onEnter: () => void;
  onBackToLook: () => void;
  busy: boolean;
  error: string | null;
}) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const sectionRefs = React.useRef<Array<HTMLDivElement | null>>([]);
  const [editing, setEditing] = React.useState<number | null>(null);

  const patch = React.useCallback(
    (next: Partial<PassageInterpretation>) =>
      onInterpretationChange({ ...interpretation, ...next }),
    [interpretation, onInterpretationChange]
  );

  const written =
    interpretation.storySections.length > 0 ||
    Boolean(interpretation.intro) ||
    Boolean(interpretation.headline);

  /** Their own words, used only when nothing was written for them. */
  const fallbackSections = React.useMemo(
    () =>
      [
        { title: "Where it started", body: fallbackAnswers.entry },
        { title: "Who you support", body: fallbackAnswers.supports },
        { title: "What you do", body: fallbackAnswers.work },
      ].filter((section) => section.body.trim().length > 0),
    [fallbackAnswers]
  );

  const storySections = written ? interpretation.storySections : fallbackSections;

  const paint = React.useCallback((progress: number, stops: number[]) => {
    sectionRefs.current.forEach((el, i) => {
      if (!el) return;
      const start = stops[i];
      const end = i + 1 < stops.length ? stops[i + 1] : 1;
      const span = Math.max(0.0001, end - start);
      const local = (progress - start) / span;
      const isLast = i === stops.length - 1;

      let opacity: number;
      let scale: number;
      let x: number;
      if (local < 0) {
        const t = Math.max(0, 1 + local / ENTER_BAND);
        opacity = t;
        scale = 0.72 + 0.28 * t;
        x = -14 * (1 - t);
      } else if (local < EXIT_AT || isLast) {
        opacity = 1;
        scale = 1;
        x = 0;
      } else {
        const t = Math.min(1, (local - EXIT_AT) / (1 - EXIT_AT));
        opacity = 1 - t;
        scale = 1 + 0.6 * t;
        x = 10 * t;
      }

      const clamped = Math.max(0, Math.min(1, opacity));
      el.style.opacity = String(clamped);
      const shown = clamped > 0;
      el.style.visibility = shown ? "visible" : "hidden";
      el.style.willChange = shown ? "transform, opacity" : "auto";
      el.style.transform = `translate3d(${x}%, -50%, 0) scale(${scale})`;
      el.style.pointerEvents = clamped > 0.6 ? "auto" : "none";
      el.style.zIndex = String(10 + i);
    });
  }, []);

  const sections: { title: string; content: React.ReactNode }[] = [
    {
      title: "Welcome",
      content: (
        <div className="flex flex-col gap-4">
          {interpretation.headline ? (
            <p className="max-w-xl font-display text-2xl leading-snug text-text-hi sm:text-3xl">
              {interpretation.headline}
            </p>
          ) : null}
          {roles.length ? (
            <p className="text-[11px] uppercase tracking-[0.22em] text-ice/70">
              {roles.join(" · ")}
            </p>
          ) : null}
          <p className="max-w-lg text-sm leading-7 text-text-hi/85">
            {interpretation.intro ||
              "You're joining a team already building something in TEMPO. Here's what you told us, before you go in."}
          </p>
          {editing === 0 ? (
            <div className="grid gap-3">
              <Input
                value={interpretation.headline}
                onChange={(e) => patch({ headline: e.target.value })}
                maxLength={140}
                placeholder="A concise line beneath your name"
                aria-label="Headline"
                className="font-display text-lg"
              />
              <Textarea
                value={interpretation.intro}
                onChange={(e) => patch({ intro: e.target.value })}
                maxLength={600}
                rows={4}
                placeholder="A short introduction"
                aria-label="Introduction"
                className="resize-none"
              />
            </div>
          ) : null}
          {written ? (
            <button
              type="button"
              onClick={() => setEditing(editing === 0 ? null : 0)}
              className="flex w-fit items-center gap-1.5 text-xs text-ice transition-colors hover:text-text-hi"
            >
              <Pencil className="size-3.5" /> {editing === 0 ? "Done editing" : "Edit"}
            </button>
          ) : null}
        </div>
      ),
    },
    {
      title: written ? "Your story" : "In your words",
      content: (
        <div className="flex flex-col gap-4">
          {storySections.map((section, i) => (
            <div
              key={`section-${i}`}
              className="rounded-2xl border border-line/60 bg-white/[0.025] p-4 sm:p-5"
            >
              {editing === 1 && written ? (
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={section.title}
                      onChange={(e) => {
                        const next = [...interpretation.storySections];
                        next[i] = { ...section, title: e.target.value };
                        patch({ storySections: next });
                      }}
                      maxLength={120}
                      aria-label={`Section ${i + 1} title`}
                      className="font-display"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        patch({
                          storySections: interpretation.storySections.filter(
                            (_, index) => index !== i
                          ),
                        })
                      }
                      className="p-2 text-text-lo hover:text-warn"
                      aria-label="Remove section"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  <Textarea
                    value={section.body}
                    onChange={(e) => {
                      const next = [...interpretation.storySections];
                      next[i] = { ...section, body: e.target.value };
                      patch({ storySections: next });
                    }}
                    maxLength={700}
                    rows={4}
                    aria-label={`Section ${i + 1} body`}
                    className="resize-none"
                  />
                </div>
              ) : (
                <>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-ice/70">
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  {section.title ? (
                    <h3 className="mt-2 font-display text-lg text-text-hi sm:text-xl">
                      {section.title}
                    </h3>
                  ) : null}
                  <p className="mt-2 text-sm leading-7 text-text-lo sm:text-[15px] sm:leading-8">
                    {section.body}
                  </p>
                </>
              )}
            </div>
          ))}
          {storySections.length === 0 ? (
            <p className="text-sm leading-7 text-text-lo">
              You passed on the questions, which is fine. You can add all of this
              later from Settings.
            </p>
          ) : null}
          {written ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setEditing(editing === 1 ? null : 1)}
                className="flex w-fit items-center gap-1.5 text-xs text-ice transition-colors hover:text-text-hi"
              >
                <Pencil className="size-3.5" /> {editing === 1 ? "Done editing" : "Edit"}
              </button>
              {editing === 1 && interpretation.storySections.length < 8 ? (
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      storySections: [...interpretation.storySections, { title: "", body: "" }],
                    })
                  }
                  className="flex w-fit items-center gap-1 text-xs text-ice"
                >
                  <Plus className="size-3.5" /> Add a section
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: "Arrival",
      content: (
        <div className="relative flex flex-col gap-5 pl-6">
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-px bg-[linear-gradient(to_bottom,var(--ice),white,var(--amber),transparent)] shadow-[0_0_16px_var(--ice)]"
          />
          <p className="font-display text-xl leading-relaxed text-text-hi">
            {displayName ? `Good to have you, ${displayName}.` : "Good to have you."}
          </p>
          <p className="text-sm leading-relaxed text-text-lo">
            Everything here can change any time from Settings. This is just a start.
          </p>
          {error ? (
            <p role="alert" className="text-xs text-warn">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <EnterTempoButton onClick={onEnter} busy={busy} />
          </div>
        </div>
      ),
    },
  ];

  const { chapter } = useOriginScrollScrub({
    scrollerRef,
    videoRef,
    chapterStops: CHAPTER_STOPS,
    enabled: !staticMode,
    onProgress: (progress) => paint(progress, CHAPTER_STOPS),
  });

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

  if (staticMode) {
    return (
      <div className="relative z-10 mx-auto w-full max-w-4xl px-5 py-16">
        {sections.map((section, i) => (
          <ChapterSection
            key={i}
            index={i}
            title={section.title}
            staticMode
            onBack={i === 0 ? onBackToLook : undefined}
          >
            {section.content}
          </ChapterSection>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={scrollerRef}
      className="origin-story-scroller no-scrollbar absolute inset-0 z-10 overflow-y-auto overscroll-contain"
    >
      <div style={{ height: `${sections.length * VH_PER_CHAPTER + 100}vh` }} className="w-full">
        <div className="sticky top-0 flex h-[calc(100dvh/var(--origin-zoom,1))] items-center overflow-hidden px-5 py-6 sm:py-8">
          {sections.map((section, i) => (
            <div
              key={i}
              ref={(el) => {
                sectionRefs.current[i] = el;
              }}
              className="absolute inset-x-5 top-1/2 will-change-[transform,opacity]"
              style={{ opacity: 0, transition: "opacity 520ms ease-out" }}
            >
              <ChapterSection
                index={i}
                title={section.title}
                staticMode={false}
                onBack={i === 0 ? onBackToLook : undefined}
              >
                {section.content}
                {i === 0 ? <ScrollCue /> : null}
              </ChapterSection>
            </div>
          ))}
        </div>
      </div>

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

function ScrollCue() {
  return (
    <div
      aria-hidden
      className="mt-7 flex w-fit items-center gap-3 rounded-full border border-ice/25 bg-bg-0/65 py-2 pl-2 pr-4 text-left shadow-[0_0_28px_rgb(var(--ice-rgb)_/_0.12)] backdrop-blur-md"
    >
      <span className="relative flex size-9 shrink-0 items-start justify-center rounded-full border border-line bg-bg-2/80">
        <span className="mt-2 block h-2 w-0.5 rounded-full bg-ice motion-safe:animate-[origin-scroll-cue_1.5s_ease-in-out_infinite]" />
      </span>
      <span className="block text-xs font-medium text-text-hi">Scroll to continue</span>
      <ArrowDown className="ml-1 size-4 text-ice motion-safe:animate-[origin-scroll-arrow_1.5s_ease-in-out_infinite]" />
    </div>
  );
}
