"use client";

import * as React from "react";
import { useActiveArtistPalette } from "@/components/active-artist-provider";
import { buildChartPalette, type ChartPalette } from "@/lib/chart-ramp";
import { cn } from "@/lib/utils";

/**
 * Shared chart primitives for the artist overview.
 *
 * Colour rules followed here (checked with the data-viz palette validator,
 * dark mode, against the surfaces these marks actually sit on):
 *
 * - Two-series categorical (bounces vs tracks started) uses lightness-stepped
 *   variants of TEMPO's fixed ice/amber tokens. The raw tokens (#7FB4FF,
 *   #FFB56B) are too light for the dark-mode band, so the hue and chroma are
 *   held and only L moves — brand hue preserved, band satisfied.
 *   Validated: band PASS, chroma PASS, CVD ΔE 23.2 (protan), normal 24.6,
 *   contrast PASS on #121216.
 * - Magnitude ramps are single-hue, monotone in lightness (ordinal check:
 *   monotone PASS, ΔL PASS, light-end contrast PASS).
 * - Stage colour is NOT from these ramps: it reuses the existing board
 *   ice → white → amber heat ramp so Board and Overview agree, and identity
 *   never rests on colour there (every stage row is named and counted).
 */

/**
 * Chart marks in the active artist's own hues, lightness-stepped into the
 * dark-mode band. With the default palette this yields the exact hexes the
 * validator cleared: series #578ad2 / #bc7728, ramp #205194 → #94c0fe,
 * momentum #efa65b → #704000.
 */
export function useChartPalette(): ChartPalette {
  const hues = useActiveArtistPalette();
  return React.useMemo(
    () => buildChartPalette({ ice: hues.ice, amber: hues.amber }),
    [hues.ice, hues.amber]
  );
}

/** One step off the surface — recessive, hairline, solid. */
export const GRID = "rgba(139, 139, 150, 0.18)";
export const AXIS_TEXT = "#8B8B96";
/** The 2px separator between touching fills is drawn in the surface colour. */
export const SURFACE_GAP = 2;

/** True pixel width of a container, so charts render crisp instead of scaled. */
export function useMeasuredWidth<T extends HTMLElement>(): [
  React.RefObject<T>,
  number,
] {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      setWidth((prev) => (Math.abs(prev - next) > 0.5 ? next : prev));
    });
    observer.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

export type TooltipState = {
  x: number;
  y: number;
  title: string;
  rows: { label: string; value: string; color?: string }[];
} | null;

/**
 * Floating value readout. Tooltips enhance and never gate: every chart here
 * also carries axis ticks, direct labels, or a "numbers" table twin.
 */
export function ChartTooltip({ state }: { state: TooltipState }) {
  if (!state) return null;
  return (
    <div
      className="pointer-events-none absolute z-20 min-w-[7rem] -translate-x-1/2 -translate-y-full rounded-input border border-line bg-bg-1/95 px-2.5 py-1.5 shadow-e3 backdrop-blur-sm"
      style={{ left: state.x, top: state.y - 8 }}
      role="status"
    >
      <p className="text-[11px] text-text-hi">{state.title}</p>
      {state.rows.map((row) => (
        <p
          key={row.label}
          className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-[11px] text-text-lo"
        >
          {row.color ? (
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: row.color }}
              aria-hidden
            />
          ) : null}
          <span>{row.label}</span>
          <span className="ml-auto tabular-nums text-text-hi">{row.value}</span>
        </p>
      ))}
    </div>
  );
}

/** Legend for two or more series — identity is never colour-alone. */
export function ChartLegend({
  items,
  className,
}: {
  items: { label: string; color: string }[];
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1", className)}>
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-1.5 text-[11px] text-text-lo"
        >
          <span
            className="size-2 rounded-full"
            style={{ background: item.color }}
            aria-hidden
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * A bar path with a 4px rounded data-end and a square baseline end.
 * `orientation` picks which end gets the radius.
 */
export function barPath(
  x: number,
  y: number,
  w: number,
  h: number,
  orientation: "up" | "right" = "up",
  radius = 4
): string {
  if (w <= 0 || h <= 0) return "";
  const r = Math.min(radius, orientation === "up" ? w / 2 : h / 2, orientation === "up" ? h : w);
  if (r <= 0) return `M${x},${y}h${w}v${h}h${-w}z`;
  if (orientation === "up") {
    // Rounded top, square bottom.
    return `M${x},${y + h}V${y + r}a${r},${r} 0 0 1 ${r},${-r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}V${y + h}z`;
  }
  // Rounded right end, square left.
  return `M${x},${y}h${w - r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 ${-r},${r}H${x}z`;
}

/** Round an axis maximum up to a clean number. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  if (value <= 5) return Math.ceil(value);
  const mag = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / mag) * mag;
}

/** Small "show the numbers" table twin, so no value is colour- or hover-only. */
export function NumbersTable({
  head,
  rows,
}: {
  head: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="mt-3 max-h-56 overflow-auto rounded-input border border-line/70">
      <table className="w-full text-left text-[11px]">
        <thead className="sticky top-0 bg-bg-2/95">
          <tr>
            {head.map((h) => (
              <th
                key={h}
                scope="col"
                className="px-2 py-1.5 font-normal text-text-lo"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-line/50">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={cn(
                    "px-2 py-1",
                    j === 0 ? "text-text-hi" : "tabular-nums text-text-lo"
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Toggle that reveals the table twin under a chart. */
export function NumbersToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="rounded-input px-1.5 py-0.5 text-[11px] text-text-lo transition-colors duration-hover hover:text-ice focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
      aria-expanded={open}
    >
      {open ? "Hide numbers" : "Numbers"}
    </button>
  );
}
