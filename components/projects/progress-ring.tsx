"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Donut progress dial. Sweeps from empty on mount so progress reads as motion. */
export function ProgressRing({
  pct,
  size = 88,
  stroke = 6,
  label = "complete",
  className,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  label?: string;
  className?: string;
}) {
  const [drawn, setDrawn] = React.useState(0);

  React.useEffect(() => {
    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDrawn(pct);
      return;
    }
    const frame = window.requestAnimationFrame(() => setDrawn(pct));
    return () => window.cancelAnimationFrame(frame);
  }, [pct]);

  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, drawn)) / 100);

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--line)"
          strokeWidth={stroke}
        />
        <defs>
          <linearGradient id="progress-ring-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--ice)" />
            <stop offset="100%" stopColor="var(--amber)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#progress-ring-gradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22, 0.8, 0.28, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-data text-lg font-semibold tabular-nums text-text-hi">{Math.round(pct)}%</span>
        <span className="text-[10px] uppercase tracking-[0.12em] text-text-lo">{label}</span>
      </div>
    </div>
  );
}
