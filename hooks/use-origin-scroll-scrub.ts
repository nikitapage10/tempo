"use client";

import * as React from "react";

/**
 * Scroll-driven scrubbing for the closing onboarding chapters.
 *
 * Native scrolling remains in charge. Continuous progress stays outside React:
 * panel styles are painted in one animation-frame loop and React only hears
 * about chapter changes.
 */

type ScrubOptions = {
  scrollerRef: React.RefObject<HTMLElement>;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  chapterStops: number[];
  enabled: boolean;
  onProgress?: (progress: number) => void;
};

/** The scrub asset is 24fps, so seeking between real frames only adds work. */
const MIN_DELTA_SECONDS = 1 / 24;
/** Keep paused-video decoding below display refresh, especially on Retina Macs. */
const MIN_SEEK_INTERVAL_MS = 1000 / 30;
const SCROLL_SETTLE_MS = 140;

export function useOriginScrollScrub({
  scrollerRef,
  videoRef,
  chapterStops,
  enabled,
  onProgress,
}: ScrubOptions): { chapter: number; progressRef: React.MutableRefObject<number> } {
  const [chapter, setChapter] = React.useState(0);
  const progressRef = React.useRef(0);
  const rafRef = React.useRef<number | null>(null);
  const lastSeekRef = React.useRef(-1);
  const lastSeekAtRef = React.useRef(-Infinity);
  const pendingSeekRef = React.useRef<number | null>(null);
  const seekVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const chapterRef = React.useRef(0);
  const onProgressRef = React.useRef(onProgress);
  onProgressRef.current = onProgress;
  const stopsRef = React.useRef(chapterStops);
  stopsRef.current = chapterStops;

  React.useEffect(() => {
    if (!enabled) return;

    let running = true;
    let paintDirty = true;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    const markDirty = () => {
      paintDirty = true;
      if (rafRef.current === null && running) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    function tick(now: number) {
      rafRef.current = null;
      if (!running) return;

      const scroller = scrollerRef.current;
      const video = videoRef.current;
      if (!scroller) return;

      if (seekVideoRef.current !== video) {
        seekVideoRef.current = video;
        lastSeekRef.current = -1;
        lastSeekAtRef.current = -Infinity;
        pendingSeekRef.current = null;
      }

      if (paintDirty) {
        paintDirty = false;
        const scrollable = scroller.scrollHeight - scroller.clientHeight;
        const progress =
          scrollable > 0
            ? Math.min(1, Math.max(0, scroller.scrollTop / scrollable))
            : 0;
        progressRef.current = progress;
        onProgressRef.current?.(progress);

        if (video && video.readyState >= 1 && Number.isFinite(video.duration)) {
          pendingSeekRef.current = Math.min(
            video.duration - 0.01,
            Math.max(0, progress * video.duration)
          );
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

      const target = pendingSeekRef.current;
      if (video && target !== null) {
        if (Math.abs(target - lastSeekRef.current) < MIN_DELTA_SECONDS) {
          pendingSeekRef.current = null;
        } else if (
          !video.seeking &&
          now - lastSeekAtRef.current >= MIN_SEEK_INTERVAL_MS
        ) {
          // Never stack seeks. Chromium otherwise queues decoder work faster
          // than it can paint it, making the glass panels stutter with the film.
          pendingSeekRef.current = null;
          lastSeekRef.current = target;
          lastSeekAtRef.current = now;
          video.currentTime = target;
        }
      }

      if (paintDirty || pendingSeekRef.current !== null || Boolean(video?.seeking)) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    const scroller = scrollerRef.current;
    if (!scroller) return;

    const onScroll = () => {
      scroller.dataset.originScrubbing = "true";
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        delete scroller.dataset.originScrubbing;
      }, SCROLL_SETTLE_MS);
      markDirty();
    };
    const onResize = () => markDirty();
    const onVisibility = () => {
      if (document.visibilityState === "visible") markDirty();
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    markDirty();

    return () => {
      running = false;
      if (settleTimer) clearTimeout(settleTimer);
      delete scroller.dataset.originScrubbing;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, scrollerRef, videoRef]);

  return { chapter, progressRef };
}
