"use client";

import { cn } from "@/lib/utils";

/**
 * TEMPO wordmark: a cluster of vertical light bars, a divider rule, then the
 * name in hairline, wide-tracked display type.
 *
 * The bars run ice → white → amber top to bottom — the same ramp as
 * `.flare-line` and the board's stage hues, so the logo is built from the
 * product's own light rather than being a separate graphic. Each bar carries
 * a soft bloom behind it for the glow in the mark.
 */

/** height (0–1), width in px, and opacity — uneven on purpose. */
const BARS: { h: number; w: number; o: number }[] = [
  { h: 0.3, w: 1, o: 0.45 },
  { h: 0.58, w: 1, o: 0.75 },
  { h: 1.0, w: 2, o: 1 },
  { h: 0.8, w: 1.5, o: 0.9 },
  { h: 0.46, w: 1, o: 0.6 },
  { h: 0.24, w: 1, o: 0.4 },
];

const RAMP =
  "linear-gradient(180deg, rgb(127 180 255 / 0) 0%, var(--ice) 18%, #ffffff 46%, var(--amber) 78%, rgb(255 181 107 / 0) 100%)";

type WordmarkProps = {
  /** Height of the tallest bar, in px. Type scales from it. */
  size?: number;
  /** Bars only — for tight spaces and the app icon. */
  markOnly?: boolean;
  className?: string;
};

export function Wordmark({
  size = 22,
  markOnly = false,
  className,
}: WordmarkProps) {
  return (
    <span
      className={cn("inline-flex select-none items-center", className)}
      aria-label="TEMPO"
      role="img"
    >
      <span
        className="relative flex shrink-0 items-center gap-[3.5px]"
        style={{ height: size }}
        aria-hidden
      >
        {/* Bloom — the haze around the bars in the mark. */}
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 blur-[6px] motion-reduce:hidden"
          style={{ width: size * 1.5, height: size * 1.1, background: RAMP, opacity: 0.35 }}
        />
        {BARS.map((bar, i) => (
          <span
            key={i}
            className="relative rounded-full"
            style={{
              width: bar.w,
              height: `${bar.h * 100}%`,
              background: RAMP,
              opacity: bar.o,
            }}
          />
        ))}
      </span>

      {!markOnly ? (
        <>
          <span
            aria-hidden
            className="mx-3 w-px shrink-0"
            style={{
              height: size * 0.92,
              background:
                "linear-gradient(180deg, transparent, rgb(242 240 235 / 0.35), transparent)",
            }}
          />
          <span
            className="font-display font-light leading-none text-text-hi/90"
            style={{
              fontSize: size * 0.72,
              letterSpacing: `${size * 0.2}px`,
              // Tracking leaves a gap after the final O — pull it back so the
              // lockup stays optically centred.
              marginRight: `-${size * 0.2}px`,
            }}
          >
            TEMPO
          </span>
        </>
      ) : null}
    </span>
  );
}
