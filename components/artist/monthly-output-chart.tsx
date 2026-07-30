"use client";

import * as React from "react";
import type { MonthPoint } from "@/lib/artist-stats";
import {
  AXIS_TEXT,
  ChartLegend,
  ChartTooltip,
  GRID,
  NumbersTable,
  NumbersToggle,
  barPath,
  niceMax,
  useChartPalette,
  useMeasuredWidth,
  type TooltipState,
} from "@/components/artist/chart-kit";

const PLOT_H = 156;
const AXIS_H = 22;
/** Headroom so the top tick and the peak label are never clipped. */
const PAD_T = 16;
const PAD_L = 26;
const PAD_R = 8;
const MAX_BAR = 24;

/**
 * Twelve months of output: bounces uploaded (columns) against tracks started
 * (line). Both are counts, so they share one axis — never a second scale.
 */
export function MonthlyOutputChart({ months }: { months: MonthPoint[] }) {
  const palette = useChartPalette();
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const [tip, setTip] = React.useState<TooltipState>(null);
  const [showNumbers, setShowNumbers] = React.useState(false);

  const max = niceMax(
    Math.max(1, ...months.map((m) => Math.max(m.bounces, m.started)))
  );
  const plotW = Math.max(0, width - PAD_L - PAD_R);
  const band = months.length > 0 ? plotW / months.length : 0;
  const barW = Math.min(MAX_BAR, Math.max(4, band * 0.5));
  const yOf = (value: number) => PAD_T + PLOT_H - (value / max) * PLOT_H;
  const xOf = (index: number) => PAD_L + band * index + band / 2;

  const ticks = [0, Math.round(max / 2), max].filter(
    (t, i, arr) => arr.indexOf(t) === i
  );

  // Direct-label the peak only — a number on every column reads as noise.
  const peakIndex = months.reduce(
    (best, m, i) => (m.bounces > months[best].bounces ? i : best),
    0
  );
  const hasPeak = months[peakIndex]?.bounces > 0;

  const linePoints = months
    .map((m, i) => `${xOf(i)},${yOf(m.started)}`)
    .join(" ");

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <ChartLegend
          items={[
            { label: "Bounces uploaded", color: palette.primary },
            { label: "Tracks started", color: palette.secondary },
          ]}
        />
        <NumbersToggle
          open={showNumbers}
          onToggle={() => setShowNumbers((v) => !v)}
        />
      </div>

      <div ref={ref} className="relative w-full">
        {width > 0 ? (
          <svg
            width={width}
            height={PAD_T + PLOT_H + AXIS_H}
            role="img"
            aria-label={`Bounces uploaded and tracks started, each month for the last twelve months. Peak ${months[peakIndex]?.bounces ?? 0} bounces in ${months[peakIndex]?.label ?? ""}.`}
            onMouseLeave={() => setTip(null)}
          >
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD_L}
                  x2={width - PAD_R}
                  y1={yOf(tick)}
                  y2={yOf(tick)}
                  stroke={GRID}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text
                  x={PAD_L - 6}
                  y={yOf(tick) + 3}
                  textAnchor="end"
                  fontSize={10}
                  fill={AXIS_TEXT}
                  className="tabular-nums"
                >
                  {tick}
                </text>
              </g>
            ))}

            {months.map((m, i) => {
              const h = (m.bounces / max) * PLOT_H;
              return (
                <path
                  key={m.key}
                  d={barPath(xOf(i) - barW / 2, yOf(m.bounces), barW, h, "up")}
                  fill={palette.primary}
                />
              );
            })}

            <polyline
              points={linePoints}
              fill="none"
              stroke={palette.secondary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {months.map((m, i) => (
              <circle
                key={m.key}
                cx={xOf(i)}
                cy={yOf(m.started)}
                r={4}
                fill={palette.secondary}
                stroke="#121216"
                strokeWidth={2}
              />
            ))}

            {hasPeak ? (
              <text
                x={xOf(peakIndex)}
                y={yOf(months[peakIndex].bounces) - 8}
                textAnchor="middle"
                fontSize={11}
                fill="#F2F0EB"
              >
                {months[peakIndex].bounces}
              </text>
            ) : null}

            {months.map((m, i) => (
              <text
                key={m.key}
                x={xOf(i)}
                y={PAD_T + PLOT_H + 15}
                textAnchor="middle"
                fontSize={10}
                fill={AXIS_TEXT}
              >
                {m.label}
              </text>
            ))}

            {/* Full-band hit targets — never make the reader land on the mark. */}
            {months.map((m, i) => (
              <rect
                key={m.key}
                x={PAD_L + band * i}
                y={0}
                width={band}
                height={PAD_T + PLOT_H + AXIS_H}
                fill="transparent"
                onMouseEnter={() =>
                  setTip({
                    x: xOf(i),
                    y: Math.min(yOf(m.bounces), yOf(m.started)),
                    title: m.label,
                    rows: [
                      {
                        label: "Bounces",
                        value: String(m.bounces),
                        color: palette.primary,
                      },
                      {
                        label: "Started",
                        value: String(m.started),
                        color: palette.secondary,
                      },
                    ],
                  })
                }
              />
            ))}
          </svg>
        ) : (
          <div style={{ height: PAD_T + PLOT_H + AXIS_H }} />
        )}
        <ChartTooltip state={tip} />
      </div>

      {showNumbers ? (
        <NumbersTable
          head={["Month", "Bounces", "Started"]}
          rows={months.map((m) => [m.label, m.bounces, m.started])}
        />
      ) : null}
    </div>
  );
}
