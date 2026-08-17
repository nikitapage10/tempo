"use client";

import { cn } from "@/lib/utils";

/** The supplied TEMPO wordmark, plus the compact light-bar mark for icon slots. */

/** height (0-1), width in px, and opacity - uneven on purpose. */
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
  /** Reference height. The wide logo is optically scaled from it. */
  size?: number;
  /** Compact light-bar mark for controls too narrow for the full wordmark. */
  markOnly?: boolean;
  /** Pair the ice→amber bars with the supplied wordmark (studio rail lockup). */
  withMark?: boolean;
  className?: string;
};

function LightBarMark({ size }: { size: number }) {
  return (
    <span
      className="relative flex shrink-0 items-center gap-[3.5px]"
      style={{ height: size }}
      aria-hidden
    >
      <span
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 blur-[6px] motion-reduce:hidden"
        style={{
          width: size * 1.5,
          height: size * 1.1,
          background: RAMP,
          opacity: 0.35,
        }}
      />
      {BARS.map((bar, index) => (
        <span
          key={index}
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
  );
}

export function Wordmark({
  size = 22,
  markOnly = false,
  withMark = false,
  className,
}: WordmarkProps) {
  return (
    <span
      className={cn(
        "inline-flex select-none items-center",
        withMark && !markOnly && "gap-2",
        className
      )}
      aria-label="TEMPO"
      role="img"
    >
      {markOnly ? (
        <LightBarMark size={size} />
      ) : (
        <>
          {withMark ? <LightBarMark size={Math.round(size * 0.7)} /> : null}
          {/* Use the supplied raster directly: its distressed edges are the
              identity, not decoration to be recreated with a typeface. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/tempo-logo.png"
            alt=""
            width={1819}
            height={264}
            draggable={false}
            className="block max-w-none shrink-0 select-none object-contain"
            style={{ height: Math.max(12, size * 0.78), width: "auto" }}
          />
        </>
      )}
    </span>
  );
}
