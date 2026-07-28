"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type InfiniteSliderProps = {
  children: React.ReactNode;
  gap?: number;
  duration?: number;
  durationOnHover?: number;
  direction?: "horizontal" | "vertical";
  reverse?: boolean;
  className?: string;
};

/**
 * Seamless infinite marquee. Two identical halves; CSS translates by exactly
 * -50% so the loop has no visible seam (unlike a JS measure → jump reset).
 */
export function InfiniteSlider({
  children,
  gap = 16,
  duration = 25,
  durationOnHover,
  direction = "horizontal",
  reverse = false,
  className,
}: InfiniteSliderProps) {
  const reduceMotion = useReducedMotion();
  const trackRef = React.useRef<HTMLDivElement>(null);

  const setPlaybackRate = React.useCallback((rate: number) => {
    const el = trackRef.current;
    if (!el) return;
    for (const anim of el.getAnimations()) {
      anim.playbackRate = rate;
    }
  }, []);

  if (reduceMotion) {
    return (
      <div
        className={cn(
          direction === "horizontal"
            ? "overflow-x-auto overflow-y-hidden"
            : "overflow-y-auto overflow-x-hidden",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          className,
        )}
      >
        <div
          className="flex w-max"
          style={{
            gap: `${gap}px`,
            flexDirection: direction === "horizontal" ? "row" : "column",
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  const horizontal = direction === "horizontal";
  // Each half carries a trailing gap so -50% of the outer strip equals
  // (content + gap) — the true visual period — with no leftover seam.
  const halfStyle: React.CSSProperties = horizontal
    ? { gap: `${gap}px`, paddingInlineEnd: `${gap}px` }
    : { gap: `${gap}px`, paddingBlockEnd: `${gap}px` };

  const hoverRate =
    durationOnHover && durationOnHover > 0 ? duration / durationOnHover : null;

  return (
    <div className={cn("overflow-hidden", className)}>
      <div
        ref={trackRef}
        className={cn(
          "flex w-max will-change-transform",
          horizontal ? "flex-row" : "flex-col",
          reverse
            ? horizontal
              ? "animate-infinite-slider-x-reverse"
              : "animate-infinite-slider-y-reverse"
            : horizontal
              ? "animate-infinite-slider-x"
              : "animate-infinite-slider-y",
          "motion-reduce:animate-none",
        )}
        style={
          {
            "--infinite-slider-duration": `${duration}s`,
          } as React.CSSProperties
        }
        onMouseEnter={
          hoverRate != null ? () => setPlaybackRate(hoverRate) : undefined
        }
        onMouseLeave={
          hoverRate != null ? () => setPlaybackRate(1) : undefined
        }
      >
        <div
          className={cn("flex shrink-0", horizontal ? "flex-row" : "flex-col")}
          style={halfStyle}
        >
          {children}
        </div>
        <div
          className={cn("flex shrink-0", horizontal ? "flex-row" : "flex-col")}
          style={halfStyle}
          aria-hidden
        >
          {children}
        </div>
      </div>
    </div>
  );
}
