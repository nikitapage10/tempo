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
 * - full: 1px full-width window onto the field
 * - partial: border track + window fill (living light in a channel)
 * - tick: short marker window
 */
export function FlareLine({
  variant = "full",
  pct = 0,
  className,
}: FlareLineProps) {
  if (variant === "tick") {
    return (
      <LfWindow
        className={cn("inline-block h-px w-3 shrink-0", className)}
        aria-hidden
      />
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

  return <LfWindow className={cn("h-px w-full", className)} aria-hidden />;
}
