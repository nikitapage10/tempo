"use client";

import * as React from "react";
import {
  RHYTHM_DAY_LABELS,
  formatHourRange,
  type RhythmCell,
} from "@/lib/artist-stats";
import {
  AXIS_TEXT,
  ChartTooltip,
  useChartPalette,
  useMeasuredWidth,
  type TooltipState,
} from "@/components/artist/chart-kit";

const ROW_H = 15;
const GAP = 2;
const LABEL_W = 30;
const AXIS_H = 16;
const HOURS = 24;

/**
 * When you actually work: sessions by weekday and hour of day.
 *
 * A magnitude grid, so a single-hue ramp — bright means more. Zero is the
 * surface itself rather than a ramp step, so "never" reads as absence instead
 * of as the lowest bucket.
 */
export function RhythmHeatmap({
  cells,
  max,
}: {
  cells: RhythmCell[];
  max: number;
}) {
  const palette = useChartPalette();
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const [tip, setTip] = React.useState<TooltipState>(null);

  if (max === 0) {
    return (
      <p className="text-sm text-text-lo">
        No sessions logged yet. Start a focus session and your working hours
        build up here.
      </p>
    );
  }

  const gridW = Math.max(0, width - LABEL_W);
  const cellW = gridW / HOURS;
  const height = RHYTHM_DAY_LABELS.length * (ROW_H + GAP) + AXIS_H;

  // Five ramp steps; count 0 stays on the surface.
  const stepFor = (count: number) => {
    if (count === 0) return null;
    const idx = Math.min(
      palette.sequential.length - 1,
      Math.floor(((count - 1) / Math.max(1, max)) * palette.sequential.length)
    );
    return palette.sequential[idx];
  };

  return (
    <div>
      <div ref={ref} className="relative w-full">
        {width > 0 ? (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`Focus sessions by day of week and hour of day. Busiest cell has ${max} session${max === 1 ? "" : "s"}.`}
            onMouseLeave={() => setTip(null)}
          >
            {RHYTHM_DAY_LABELS.map((label, day) => (
              <text
                key={label}
                x={0}
                y={day * (ROW_H + GAP) + ROW_H - 3}
                fontSize={10}
                fill={AXIS_TEXT}
              >
                {label}
              </text>
            ))}

            {cells.map((cell) => {
              const fill = stepFor(cell.count);
              const x = LABEL_W + cell.hour * cellW;
              const y = cell.day * (ROW_H + GAP);
              return (
                <rect
                  key={`${cell.day}-${cell.hour}`}
                  x={x}
                  y={y}
                  width={Math.max(1, cellW - GAP)}
                  height={ROW_H}
                  rx={2}
                  fill={fill ?? "rgba(139,139,150,0.08)"}
                  onMouseEnter={() =>
                    setTip({
                      x: x + cellW / 2,
                      y,
                      title: `${RHYTHM_DAY_LABELS[cell.day]} ${formatHourRange(cell.hour)}`,
                      rows: [
                        {
                          label: cell.count === 1 ? "session" : "sessions",
                          value: String(cell.count),
                          color: fill ?? undefined,
                        },
                      ],
                    })
                  }
                />
              );
            })}

            {[0, 6, 12, 18].map((hour) => (
              <text
                key={hour}
                x={LABEL_W + hour * cellW}
                y={height - 3}
                fontSize={10}
                fill={AXIS_TEXT}
              >
                {hour === 0 ? "12am" : hour === 12 ? "12pm" : `${hour % 12}${hour < 12 ? "am" : "pm"}`}
              </text>
            ))}
          </svg>
        ) : (
          <div style={{ height }} />
        )}
        <ChartTooltip state={tip} />
      </div>

      {/* Scale legend — a continuous ramp always ships one. */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[11px] text-text-lo">Fewer</span>
        <span className="flex gap-[2px]">
          {palette.sequential.map((step) => (
            <span
              key={step}
              className="size-2.5 rounded-[2px]"
              style={{ background: step }}
              aria-hidden
            />
          ))}
        </span>
        <span className="text-[11px] text-text-lo">
          More · up to <span className="tabular-nums text-text-hi">{max}</span>{" "}
          per hour
        </span>
      </div>
    </div>
  );
}
