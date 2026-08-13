"use client";

import * as React from "react";
import { ArrowDown, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOriginScrollScrub } from "@/hooks/use-origin-scroll-scrub";
import { PASSAGE_ROLE_OTHER } from "@/lib/passage/roles";
import { cn } from "@/lib/utils";

/**
 * Frame 6 — the recap, scrubbed by scrolling. Same mechanism as
 * components/origin/origin-story-scroll.tsx, cut down to a plain read-only
 * recap: PASSAGE has nothing generated to review or edit, so there is no
 * chapter here that owns interactive content.
 */

const CHAPTER_STOPS = [0, 0.2, 0.42, 0.64, 0.86];
const CHAPTER_TITLES = ["Welcome", "Where it started", "Who you support", "What you do", "Arrival"];
const CHAPTER_KICKERS = ["Welcome", "Origin", "Support", "Work", "Arrival"];
const CHAPTER_ALIGN = ["sm:ml-[6%]", "sm:ml-[6%]", "sm:ml-[6%]", "sm:ml-[6%]", "sm:ml-[6%]"];
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

function ChapterBackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-4 flex w-fit items-center gap-1 text-xs uppercase tracking-[0.16em] text-text-lo transition-colors hover:text-text-hi"
    >
      <ChevronLeft className="size-3.5" /> Back
    </button>
  );
}

function ChapterSection({
  index,
  staticMode,
  children,
  onBack,
}: {
  index: number;
  staticMode: boolean;
  children: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <section aria-labelledby={`passage-chapter-${index}`} className={cn(staticMode && "py-12")}>
      <div
        className={cn(
          "relative flex w-full max-w-2xl flex-col overflow-hidden rounded-[26px] border bg-[linear-gradient(125deg,rgb(9_10_13/0.9),rgb(21_25_32/0.76),rgb(10_10_13/0.86))] shadow-3 backdrop-blur-xl",
          "max-h-[min(86dvh,52rem)]",
          index % 2 === 0 ? "border-amber/25" : "border-ice/30",
          CHAPTER_ALIGN[index]
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute -right-20 -top-24 size-56 rounded-full border opacity-70",
            index % 2 === 0 ? "border-amber/15 bg-amber/[0.025]" : "border-ice/15 bg-ice/[0.03]"
          )}
        />
        <div className="relative grid min-h-0 grid-cols-[2.5rem_1fr] gap-5 px-6 py-7 sm:grid-cols-[3rem_1fr] sm:gap-7 sm:px-8 sm:py-8">
          <div className="flex flex-col items-center gap-3 pt-0.5 text-[10px] uppercase tracking-[0.2em] text-text-lo/70">
            <span className={cn("font-mono", index % 2 === 0 ? "text-amber" : "text-ice")}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="h-10 w-px bg-[linear-gradient(to_bottom,var(--line),transparent)]" />
            <span className="[writing-mode:vertical-rl]">{CHAPTER_KICKERS[index]}</span>
          </div>
          <div className="min-h-0 min-w-0">
            {onBack ? <ChapterBackButton onClick={onBack} /> : null}
            <h2 id={`passage-chapter-${index}`} className="shrink-0 text-xs uppercase tracking-[0.24em] text-text-hi/90">
              {CHAPTER_TITLES[index]}
            </h2>
            <div className="mt-5 min-h-0">{children}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PassageStoryScroll({
  roleTitle,
  roleTitleOther,
  entryText,
  supportsText,
  functionText,
  staticMode,
  videoRef,
  onEnter,
  onBackToLook,
  busy,
  error,
}: {
  roleTitle: string;
  roleTitleOther: string;
  entryText: string;
  supportsText: string;
  functionText: string;
  staticMode: boolean;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  onEnter: () => void;
  onBackToLook: () => void;
  busy: boolean;
  error: string | null;
}) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const sectionRefs = React.useRef<Array<HTMLDivElement | null>>([]);

  const displayRole = roleTitle === PASSAGE_ROLE_OTHER ? roleTitleOther : roleTitle;

  const paint = React.useCallback((progress: number) => {
    const stops = CHAPTER_STOPS;
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
      el.style.transform = `translate3d(${x}%, -50%, 0) scale(${scale})`;
      el.style.pointerEvents = clamped > 0.6 ? "auto" : "none";
      el.style.zIndex = String(10 + i);
    });
  }, []);

  const { chapter } = useOriginScrollScrub({
    scrollerRef,
    videoRef,
    chapterStops: CHAPTER_STOPS,
    enabled: !staticMode,
    onProgress: paint,
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

  const sections = [
    <div key="welcome" className="flex flex-col gap-4">
      <p className="max-w-lg text-sm leading-7 text-text-hi/85">
        You&rsquo;re about to join a team already building something in TEMPO.
        Here&rsquo;s what you told us, before you go in.
      </p>
    </div>,

    <div key="entry" className="flex flex-col gap-3">
      <p className="text-sm leading-7 text-text-lo">
        {entryText || "You passed on this one — you can fill it in any time from Settings."}
      </p>
    </div>,

    <div key="support" className="flex flex-col gap-3">
      <p className="text-[11px] uppercase tracking-[0.22em] text-ice/70">
        {displayRole || "Team member"}
      </p>
      <p className="text-sm leading-7 text-text-lo">
        {supportsText || "You passed on this one — you can fill it in any time from Settings."}
      </p>
    </div>,

    <div key="function" className="flex flex-col gap-3">
      <p className="text-sm leading-7 text-text-lo">
        {functionText || "You passed on this one — you can fill it in any time from Settings."}
      </p>
    </div>,

    <div key="final" className="relative flex flex-col gap-5 pl-6">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-px bg-[linear-gradient(to_bottom,var(--ice),white,var(--amber),transparent)] shadow-[0_0_16px_var(--ice)]"
      />
      <p className="font-display text-xl leading-relaxed text-text-hi">
        The team is waiting on the other side.
      </p>
      <p className="text-sm leading-relaxed text-text-lo">
        Everything here can change any time from Settings — this is just a start.
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
      <div className="relative z-10 mx-auto w-full max-w-4xl px-5 py-16">
        {sections.map((content, i) => (
          <ChapterSection key={i} index={i} staticMode onBack={i === 0 ? undefined : onBackToLook}>
            {content}
          </ChapterSection>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={scrollerRef}
      className="no-scrollbar absolute inset-0 z-10 overflow-y-auto overscroll-contain"
    >
      <div style={{ height: `${sections.length * VH_PER_CHAPTER + 100}vh` }} className="w-full">
        <div className="sticky top-0 flex h-[100dvh] items-center overflow-hidden px-5 py-6 sm:py-8">
          {sections.map((content, i) => (
            <div
              key={i}
              ref={(el) => {
                sectionRefs.current[i] = el;
              }}
              className="absolute inset-x-5 top-1/2 will-change-[transform,opacity]"
              style={{ opacity: 0, transition: "opacity 520ms ease-out" }}
            >
              <ChapterSection index={i} staticMode={false}>
                {content}
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
      <span>
        <span className="block text-xs font-medium text-text-hi">Scroll to continue</span>
      </span>
      <ArrowDown className="ml-1 size-4 text-ice motion-safe:animate-[origin-scroll-arrow_1.5s_ease-in-out_infinite]" />
    </div>
  );
}
