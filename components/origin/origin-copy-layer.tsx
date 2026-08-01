"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Copy layered over the film.
 *
 * Every line is live semantic HTML — nothing is baked into a video frame, so it
 * stays selectable, translatable, and readable by a screen reader. Timing is
 * expressed as a fraction of the clip's duration rather than absolute seconds,
 * so re-cutting an asset by a few frames doesn't desynchronise the words.
 */

export type TimedLine = {
  text: string;
  /** Normalized playback position, 0–1, at which the line appears. */
  at: number;
  /** Normalized position at which it leaves. Omit to hold to the end. */
  until?: number;
};

/**
 * Normalized progress (0–1) through whatever clip is currently on screen.
 *
 * Steps use this to fade themselves in over the *tail* of a transition, so the
 * panel is already settled by the time the destination loop takes over. Without
 * it the panel mounts only once the transition has ended, which reads as a
 * skip: film, beat of nothing, then a box appears.
 *
 * Sampled on `timeupdate` (~4Hz) rather than rAF — this drives one opacity
 * threshold, not an animation, so cheap and coarse is right.
 */
export function useClipProgress(
  videoRef: React.MutableRefObject<HTMLVideoElement | null>,
  /** Resets progress whenever the phase changes. */
  resetKey: string,
  /**
   * Only bind when the element on screen really is the one we're timing.
   * Pass `activeKeyRef.current === clip.key`. Without this the hook happily
   * tracks the previous clip — which, if it loops, reports progress near 1
   * immediately and reveals the next panel before its transition has played.
   */
  matches = true,
  /** Bumped by the stage when it swaps elements, to re-run the binding. */
  tick = 0
): number {
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    setProgress(0);
    if (!matches) return;
    const video = videoRef.current;
    if (!video) return;

    const onTime = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      setProgress(Math.min(1, video.currentTime / video.duration));
    };
    video.addEventListener("timeupdate", onTime);
    onTime();
    return () => video.removeEventListener("timeupdate", onTime);
  }, [videoRef, resetKey, matches, tick]);

  return progress;
}

/** Fades a step in without unmounting it, so it can settle before it is needed. */
export function StepFade({
  show,
  children,
  className,
}: {
  show: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "transition-opacity duration-[900ms] ease-out motion-reduce:transition-none",
        show ? "opacity-100" : "pointer-events-none opacity-0",
        className
      )}
      // Hidden from assistive tech until it is actually the live step.
      aria-hidden={!show}
    >
      {children}
    </div>
  );
}

/** Body copy never sits directly on raw spectral movement — see §29. */
export function OriginScrim({
  children,
  className,
  tone = "panel",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "panel" | "veil";
}) {
  return (
    <div
      className={cn(
        tone === "panel"
          ? "rounded-panel border border-line/60 bg-bg-0/90 p-6 shadow-3 backdrop-blur-xl"
          : "rounded-panel bg-gradient-to-b from-bg-0/85 via-bg-0/70 to-transparent p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Reveals timed lines against a video's own progress.
 *
 * Progress is sampled on `timeupdate` (~4/second), which is coarse enough not
 * to churn React and fine enough for copy that changes a handful of times.
 */
export function TimedCopy({
  lines,
  videoRef,
  /** Static mode has no playhead — show everything at once. */
  showAll = false,
  className,
}: {
  lines: TimedLine[];
  videoRef?: React.MutableRefObject<HTMLVideoElement | null>;
  showAll?: boolean;
  className?: string;
}) {
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    if (showAll) return;
    const video = videoRef?.current;
    if (!video) return;
    const onTime = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      setProgress(video.currentTime / video.duration);
    };
    video.addEventListener("timeupdate", onTime);
    return () => video.removeEventListener("timeupdate", onTime);
  }, [videoRef, showAll]);

  return (
    <div className={cn("flex flex-col items-end gap-3 text-right", className)}>
      {lines.map((line) => {
        const visible =
          showAll || (progress >= line.at && (line.until === undefined || progress < line.until));
        return (
          <p
            key={line.text}
            className={cn(
              "font-display text-balance text-2xl leading-snug text-text-hi transition-opacity duration-700 sm:text-3xl",
              "motion-reduce:transition-none",
              visible ? "opacity-100" : "opacity-0"
            )}
          >
            {line.text}
          </p>
        );
      })}
    </div>
  );
}

/**
 * The layer that holds interactive content above the film.
 *
 * Right-middle, not centred: the supplied footage carries its subject on the
 * left, so copy sitting centre-screen lands on top of it. On narrow screens it
 * falls back to full width, where there is no room to sit to one side.
 */
export function OriginOverlay({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // Pointer events are re-enabled per panel so the video never swallows clicks.
        //
        // z-20 is load-bearing. The two video layers carry z-index 1 and 2 so
        // the incoming one can blend over the outgoing one; a positioned
        // element with `z-index: auto` paints *below* both, which put every
        // panel behind the film and made them look as though they had never
        // rendered. Anything layered over the stage needs an explicit z above 3
        // (the grain).
        "pointer-events-none absolute inset-0 z-20 flex flex-col justify-center",
        "items-stretch sm:items-end",
        // Middle-right: inset from the edge so the panel sits in the right half
        // rather than hugging the frame.
        "px-5 sm:pr-[14vw]",
        "pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]",
        className
      )}
    >
      {children}
    </div>
  );
}
