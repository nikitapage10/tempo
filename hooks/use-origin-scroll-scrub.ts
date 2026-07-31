"use client";

import * as React from "react";

/**
 * Scroll-driven scrubbing for the chapter section.
 *
 * Native scrolling only: no wheel interception, no preventDefault, no document
 * translation, no scroll library. A tall container scrolls normally, a sticky
 * stage stays in view, and the video's currentTime is mapped from how far
 * through that container the viewport has travelled. Browser Back, keyboard
 * scrolling, and mobile momentum all keep working because nothing is hijacked.
 *
 * Continuous progress deliberately never enters React state — it drives the
 * video from a ref inside one rAF loop. React is told only when the *chapter*
 * changes, which is a handful of times across the whole section.
 *
 * This requires an all-intra scroll asset. Against a normally-encoded file
 * (one keyframe) seeks cost hundreds of milliseconds and the effect collapses;
 * see ARTIST-ORIGIN-ONBOARDING-SPEC.md for the measurements.
 */

type ScrubOptions = {
  /**
   * The element that actually scrolls. ORIGIN runs inside a fixed full-screen
   * stage, so the document never scrolls — progress has to come from this
   * element's own scrollTop, not from the window.
   */
  scrollerRef: React.RefObject<HTMLElement>;
  /** The active video element, handed over by the media stage. */
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  /** Fractional boundaries, ascending, e.g. [0, 0.18, 0.42, 0.66, 0.88]. */
  chapterStops: number[];
  /** Off in static mode — the story renders as stacked sections instead. */
  enabled: boolean;
};

type VideoWithFastSeek = HTMLVideoElement & { fastSeek?: (t: number) => void };

/** Below this the seek isn't worth issuing — it wouldn't change the frame. */
const MIN_DELTA_SECONDS = 1 / 48;

export function useOriginScrollScrub({
  scrollerRef,
  videoRef,
  chapterStops,
  enabled,
}: ScrubOptions): { chapter: number; progressRef: React.MutableRefObject<number> } {
  const [chapter, setChapter] = React.useState(0);
  const progressRef = React.useRef(0);
  const rafRef = React.useRef<number | null>(null);
  const lastSeekRef = React.useRef(-1);
  const chapterRef = React.useRef(0);
  const stopsRef = React.useRef(chapterStops);
  stopsRef.current = chapterStops;

  React.useEffect(() => {
    if (!enabled) return;

    let running = true;
    let dirty = true;

    const markDirty = () => {
      dirty = true;
      if (rafRef.current === null && running) rafRef.current = requestAnimationFrame(tick);
    };

    function tick() {
      rafRef.current = null;
      if (!running || !dirty) return;
      dirty = false;

      const scroller = scrollerRef.current;
      const video = videoRef.current;
      if (!scroller) return;

      // One read pass, then one write pass — never interleaved.
      const scrollable = scroller.scrollHeight - scroller.clientHeight;
      const progress =
        scrollable > 0 ? Math.min(1, Math.max(0, scroller.scrollTop / scrollable)) : 0;
      progressRef.current = progress;

      if (video && video.readyState >= 1 && Number.isFinite(video.duration)) {
        const target = Math.min(video.duration - 0.01, Math.max(0, progress * video.duration));
        if (Math.abs(target - lastSeekRef.current) >= MIN_DELTA_SECONDS) {
          lastSeekRef.current = target;
          const v = video as VideoWithFastSeek;
          // fastSeek lands on the nearest frame without the exactness work;
          // on an all-intra file that is the frame we want anyway.
          if (typeof v.fastSeek === "function") v.fastSeek(target);
          else video.currentTime = target;
        }
      }

      const stops = stopsRef.current;
      let next = 0;
      for (let i = 0; i < stops.length; i += 1) {
        if (progress >= stops[i]) next = i;
      }
      if (next !== chapterRef.current) {
        chapterRef.current = next;
        setChapter(next);
      }
    }

    const scroller = scrollerRef.current;
    if (!scroller) return;

    const onScroll = () => markDirty();
    const onResize = () => markDirty();
    const onVisibility = () => {
      if (document.visibilityState === "visible") markDirty();
    };

    // Passive: this never blocks or cancels the browser's own scrolling.
    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    markDirty();

    return () => {
      running = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, scrollerRef, videoRef]);

  return { chapter, progressRef };
}
