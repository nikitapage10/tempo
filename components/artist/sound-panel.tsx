"use client";

import * as React from "react";
import type { BpmBucket, CountPoint } from "@/lib/artist-stats";
import {
  AXIS_TEXT,
  ChartTooltip,
  GRID,
  barPath,
  niceMax,
  useChartPalette,
  useMeasuredWidth,
  type TooltipState,
} from "@/components/artist/chart-kit";

const PLOT_H = 96;
const AXIS_H = 20;
const PAD_L = 20;
const PAD_R = 6;
const MAX_BAR = 24;

/**
 * BPM distribution in 10-BPM buckets. One series, so one colour and no
 * legend box — the heading says what is plotted.
 */
export function BpmHistogram({
  buckets,
  medianBpm,
}: {
  buckets: BpmBucket[];
  medianBpm: number | null;
}) {
  const palette = useChartPalette();
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const [tip, setTip] = React.useState<TooltipState>(null);

  if (buckets.length === 0) {
    return (
      <p className="text-sm text-text-lo">
        No BPMs recorded yet. Add one on a track and the shape of your tempo
        shows up here.
      </p>
    );
  }

  const max = niceMax(Math.max(1, ...buckets.map((b) => b.count)));
  const plotW = Math.max(0, width - PAD_L - PAD_R);
  const band = plotW / buckets.length;
  const barW = Math.min(MAX_BAR, Math.max(4, band - 4));
  const yOf = (v: number) => PLOT_H - (v / max) * PLOT_H;
  const xOf = (i: number) => PAD_L + band * i + band / 2;

  // Label every other bucket edge when they'd otherwise collide.
  const labelStep = band < 34 ? 2 : 1;

  return (
    <div>
      <div ref={ref} className="relative w-full">
        {width > 0 ? (
          <svg
            width={width}
            height={PLOT_H + AXIS_H}
            role="img"
            aria-label={`Tracks by tempo, in ten BPM buckets${medianBpm ? `, median ${medianBpm} BPM` : ""}.`}
            onMouseLeave={() => setTip(null)}
          >
            <line
              x1={PAD_L}
              x2={width - PAD_R}
              y1={PLOT_H}
              y2={PLOT_H}
              stroke={GRID}
              strokeWidth={1}
              shapeRendering="crispEdges"
            />
            <text
              x={PAD_L - 5}
              y={yOf(max) + 4}
              textAnchor="end"
              fontSize={10}
              fill={AXIS_TEXT}
              className="tabular-nums"
            >
              {max}
            </text>

            {buckets.map((b, i) => (
              <path
                key={b.start}
                d={barPath(
                  xOf(i) - barW / 2,
                  yOf(b.count),
                  barW,
                  (b.count / max) * PLOT_H,
                  "up"
                )}
                fill={palette.primary}
              />
            ))}

            {buckets.map((b, i) =>
              i % labelStep === 0 ? (
                <text
                  key={b.start}
                  x={xOf(i)}
                  y={PLOT_H + 14}
                  textAnchor="middle"
                  fontSize={10}
                  fill={AXIS_TEXT}
                  className="tabular-nums"
                >
                  {b.start}
                </text>
              ) : null
            )}

            {buckets.map((b, i) => (
              <rect
                key={b.start}
                x={PAD_L + band * i}
                y={0}
                width={band}
                height={PLOT_H + AXIS_H}
                fill="transparent"
                onMouseEnter={() =>
                  setTip({
                    x: xOf(i),
                    y: yOf(b.count),
                    title: `${b.start}–${b.end} BPM`,
                    rows: [
                      {
                        label: b.count === 1 ? "track" : "tracks",
                        value: String(b.count),
                        color: palette.primary,
                      },
                    ],
                  })
                }
              />
            ))}
          </svg>
        ) : (
          <div style={{ height: PLOT_H + AXIS_H }} />
        )}
        <ChartTooltip state={tip} />
      </div>
    </div>
  );
}

/**
 * Ranked list with a proportional bar. Keys, genres and types are nominal with
 * more classes than colour can carry, so they take one hue and lean on the
 * label — never a rainbow, never a value-ramp.
 */
export function RankedBars({
  items,
  emptyCopy,
  unit,
}: {
  items: CountPoint[];
  emptyCopy: string;
  unit?: string;
}) {
  const palette = useChartPalette();
  if (items.length === 0) {
    return <p className="text-sm text-text-lo">{emptyCopy}</p>;
  }
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-3">
          <span className="w-[38%] shrink-0 truncate text-[12px] text-text-hi">
            {item.label}
          </span>
          <span className="relative h-3 flex-1 overflow-hidden rounded-[2px] bg-bg-2/60">
            <span
              className="absolute inset-y-0 left-0 rounded-r-[4px]"
              style={{
                width: `${Math.max((item.count / max) * 100, 2)}%`,
                background: palette.primary,
              }}
            />
          </span>
          <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-text-lo">
            {item.count}
            {unit ? <span className="text-text-lo/70"> {unit}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
