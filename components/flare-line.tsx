"use client";

import { LfWindow } from "@/components/lf-windows";
import { cn } from "@/lib/utils";

type FlareLineProps = {
  variant?: "full" | "partial" | "tick";
  /** 0–100 for `partial` */
  pct?: number;
  className?: string;
};

/**
 * Spectra flare motif as Lightfield windows (v2 §2).
 * - full: 1px full-width window onto the field (video backdrop slits so the
 *   shader can run through the line while the wash stays everywhere else)
 * - partial: border track + window fill (living light in a channel)
 * - tick: short marker window
 *
 * A screen-blended CSS ice→amber wash tints the slit without sealing it —
 * when the field is paused, the wash still reads as the familiar rule.
 */
export function FlareLine({
  variant = "full",
  pct = 0,
  className,
}: FlareLineProps) {
  if (variant === "tick") {
    return (
      <span className={cn("relative inline-block h-px w-3 shrink-0", className)}>
        <LfWindow className="absolute inset-0" aria-hidden />
        <span
          className="flare-line pointer-events-none absolute inset-0 opacity-45 mix-blend-screen"
          aria-hidden
        />
      </span>
    );
  }

  if (variant === "partial") {
    const width = Math.max(0, Math.min(100, pct));
    return (
      <div
        className={cn(
          "relative h-[2px] w-full overflow-hidden rounded-full",
          className
        )}
        style={{ background: "var(--line)" }}
        role="progressbar"
        aria-valuenow={Math.round(width)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <LfWindow
          className="absolute inset-y-0 left-0 brightness-[1.3] transition-[width] duration-hover"
          style={{ width: `${width}%` }}
          enabled={width > 0}
        />
      </div>
    );
  }

  return (
    <div className={cn("relative h-px w-full", className)}>
      <LfWindow className="absolute inset-0" aria-hidden />
      <div
        className="flare-line pointer-events-none absolute inset-0 opacity-45 mix-blend-screen"
        aria-hidden
      />
    </div>
  );
}
