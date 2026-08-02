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

/**
 * Fades a step in without unmounting it, so it can settle before it is needed.
 *
 * Only this wrapper animates, and only `opacity` and `transform`. The panel
 * inside keeps its background, border and backdrop blur at full strength for
 * every frame of the move — animating those directly is what made a panel look
 * washed out and half-dissolved while it arrived, with the film's own streaks
 * reading straight through the words.
 *
 * The wrapper also stays `hidden` until it has been painted once at opacity 0.
 * Mounting straight into the transition gives the browser a frame in which the
 * glass is composited before it has anything to composite against, which is the
 * other half of that same artefact.
 */
export function StepFade({
  show,
  children,
  className,
  enterMs = 620,
  exitMs = 480,
}: {
  show: boolean;
  children: React.ReactNode;
  className?: string;
  enterMs?: number;
  exitMs?: number;
}) {
  const [primed, setPrimed] = React.useState(false);

  React.useEffect(() => {
    // Two frames: the first paints the panel at rest, the second is the one the
    // transition can actually start from.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setPrimed(true));
    });
    // rAF does not run in a tab that isn't compositing, and this gate holds
    // `visibility: hidden`. Without a timer a panel that mounted in a
    // backgrounded tab would still be invisible when the artist came back.
    const fallback = setTimeout(() => setPrimed(true), 120);
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      clearTimeout(fallback);
    };
  }, []);

  const visible = show && primed;

  return (
    <div
      className={cn(
        "transition-[opacity,transform] ease-out motion-reduce:transition-none",
        !visible && "pointer-events-none",
        className
      )}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translate3d(0,0,0)" : "translate3d(0,14px,0)",
        transitionDuration: `${visible ? enterMs : exitMs}ms`,
        visibility: primed ? "visible" : "hidden",
        willChange: "opacity, transform",
      }}
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
  onScroll,
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "panel" | "veil" | "story";
  onScroll?: React.UIEventHandler<HTMLDivElement>;
}) {
  return (
    <div
      className={cn(
        // Near-solid on purpose. A panel carrying body copy has to stay
        // readable over raw spectral movement at every frame of its arrival,
        // not only once it has settled.
        tone === "panel"
          ? "rounded-panel border border-line/60 bg-bg-0/95 p-6 shadow-3 backdrop-blur-xl"
          : tone === "story"
            ? "rounded-panel border border-line/80 bg-[linear-gradient(135deg,rgb(10_10_12/0.95),rgb(18_18_22/0.9))] p-6 shadow-3 backdrop-blur-xl"
            : "rounded-panel bg-gradient-to-b from-bg-0/85 via-bg-0/70 to-transparent p-6",
        className
      )}
      onScroll={onScroll}
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
  resetKey = "timed-copy",
  matches = true,
  tick = 0,
}: {
  lines: TimedLine[];
  videoRef?: React.MutableRefObject<HTMLVideoElement | null>;
  showAll?: boolean;
  className?: string;
  resetKey?: string;
  matches?: boolean;
  tick?: number;
}) {
  const fallbackRef = React.useRef<HTMLVideoElement | null>(null);
  const progress = useClipProgress(
    videoRef ?? fallbackRef,
    resetKey,
    !showAll && matches,
    tick
  );

  return (
    // One grid cell for every line. Stacking them in normal flow made each line
    // sit half the block's height off the film's centre, which is what put the
    // opening copy out of line with the streak.
    <div
      className={cn(
        "grid justify-items-end text-right [&>*]:col-start-1 [&>*]:row-start-1",
        className
      )}
    >
      {lines.map((line) => {
        const visible =
          showAll ||
          (matches &&
            progress >= line.at &&
            (line.until === undefined || progress < line.until));
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
        "pointer-events-none absolute inset-0 z-20 grid place-items-center",
        "[&>*]:col-start-1 [&>*]:row-start-1 justify-items-stretch sm:justify-items-end",
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
