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
          ? "rounded-panel border border-line/60 bg-bg-0/75 p-6 shadow-2 backdrop-blur-md"
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
    <div className={cn("flex flex-col items-center gap-3 text-center", className)}>
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

/** The layer that holds interactive content above the film. */
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
        "pointer-events-none absolute inset-0 flex flex-col items-center justify-center",
        "px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]",
        className
      )}
    >
      {children}
    </div>
  );
}
