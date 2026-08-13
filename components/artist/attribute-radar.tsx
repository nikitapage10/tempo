"use client";

import * as React from "react";
import { useChartPalette, AXIS_TEXT, GRID } from "@/components/artist/chart-kit";
import type { Attribute } from "@/lib/gamification/attributes";
import { cn } from "@/lib/utils";

const RINGS = [25, 50, 75, 100];

// Full names are already right there in the row list beside the radar — the
// axis labels only need to be short enough that two adjacent vertices (60°
// apart, in a compact hexagon) never overlap. Standard radar-chart practice.
const SHORT_LABEL: Record<string, string> = {
  "FOLLOW-THROUGH": "FOLLOW-THRU",
  "STAGE PRESENCE": "STAGE",
};

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * The hexagon stat block — one spoke per attribute, arranged clockwise from
 * the top. Unmeasured axes never collapse to a zero-length spoke (that would
 * read as a verdict); the fill path skips them and their spoke renders
 * dashed with a hollow ring instead, so "no data" stays visibly distinct
 * from "measured, and it's low."
 */
export function AttributeRadar({
  attributes,
  highlightKey,
  onSelect,
  size = 320,
  className,
}: {
  attributes: Attribute[];
  highlightKey?: string | null;
  onSelect?: (key: string) => void;
  size?: number;
  className?: string;
}) {
  const palette = useChartPalette();
  const n = attributes.length;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 46;

  const angleFor = (i: number) => (360 / n) * i;

  const points = attributes.map((a, i) => {
    const angle = angleFor(i);
    const measured = a.rating !== null;
    const r = measured ? (Math.max(0, Math.min(100, a.rating!)) / 100) * maxR : maxR * 0.5;
    return { attribute: a, angle, measured, ...polar(cx, cy, r, angle) };
  });

  const measuredPoints = points.filter((p) => p.measured);
  const fillPath =
    measuredPoints.length >= 3
      ? measuredPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z"
      : null;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={cn("mx-auto overflow-visible", className)}
      role="img"
      aria-label="Artist attribute radar"
    >
      {RINGS.map((pct) => {
        const r = (pct / 100) * maxR;
        const ringPoints = Array.from({ length: n }, (_, i) => polar(cx, cy, r, angleFor(i)));
        return (
          <polygon
            key={pct}
            points={ringPoints.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={GRID}
            strokeWidth={1}
          />
        );
      })}

      {points.map((p, i) => {
        const outer = polar(cx, cy, maxR, p.angle);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={outer.x}
            y2={outer.y}
            stroke={GRID}
            strokeWidth={1}
            strokeDasharray={p.measured ? undefined : "2 3"}
          />
        );
      })}

      {fillPath ? (
        <path
          d={fillPath}
          fill={palette.primary}
          fillOpacity={0.18}
          stroke={palette.primary}
          strokeWidth={1.5}
        />
      ) : null}

      {points.map((p, i) => {
        const isHighlighted = highlightKey === p.attribute.key;
        return p.measured ? (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={isHighlighted ? 4 : 3}
            fill={isHighlighted ? palette.secondary : palette.primary}
            stroke="var(--bg-1)"
            strokeWidth={1}
          />
        ) : (
          <circle
            key={i}
            cx={polar(cx, cy, maxR, p.angle).x}
            cy={polar(cx, cy, maxR, p.angle).y}
            r={3}
            fill="none"
            stroke={AXIS_TEXT}
            strokeWidth={1}
            strokeDasharray="1.5 2"
          />
        );
      })}

      {points.map((p, i) => {
        const label = polar(cx, cy, maxR + 18, p.angle);
        const cos = Math.cos(((p.angle - 90) * Math.PI) / 180);
        const anchor = Math.abs(cos) < 0.35 ? "middle" : cos > 0 ? "start" : "end";
        const shortLabel = SHORT_LABEL[p.attribute.label] ?? p.attribute.label;
        return (
          <g
            key={i}
            className={onSelect ? "cursor-pointer" : undefined}
            onClick={() => onSelect?.(p.attribute.key)}
          >
            <text
              x={label.x}
              y={label.y - 3}
              textAnchor={anchor}
              className="label-mono"
              fill={highlightKey === p.attribute.key ? "var(--text-hi)" : AXIS_TEXT}
              fontSize={8}
              letterSpacing="0.02em"
            >
              {shortLabel}
            </text>
            <text
              x={label.x}
              y={label.y + 11}
              textAnchor={anchor}
              className="font-data tabular-nums"
              fill={p.measured ? "var(--text-hi)" : AXIS_TEXT}
              fontSize={12}
              fontWeight={500}
            >
              {p.measured ? Math.round(p.attribute.rating!) : "—"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
