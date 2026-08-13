"use client";

import * as React from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { RadialTrack, useChartPalette } from "@/components/artist/chart-kit";
import type { Attribute } from "@/lib/gamification/attributes";
import { cn } from "@/lib/utils";

/**
 * One attribute — name, rating, and the tap-to-see-the-math breakdown. This
 * is the anti-cheese mechanism the whole design leans on: nothing here is a
 * mystery number. Expanding a row shows the plain-English headline, the
 * anchor curve that turned the raw point total into a 0–100 rating (drawn as
 * a small scale with a marker at the real value — visible proof this wasn't
 * handed down), and a nudge when there's something concrete to act on.
 */
export function AttributeRow({
  attribute,
  expanded,
  onToggle,
  variant = "full",
}: {
  attribute: Attribute;
  expanded: boolean;
  onToggle: () => void;
  variant?: "full" | "compact";
}) {
  const palette = useChartPalette();
  const measured = attribute.rating !== null;

  return (
    <div className="border-b border-line/50 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 py-2.5 text-left"
        aria-expanded={expanded}
      >
        {variant === "full" ? (
          <RadialTrack
            value={measured ? (attribute.rating ?? 0) / 100 : 0}
            color={measured ? palette.primary : "rgba(139,139,150,0.3)"}
            size={30}
            strokeWidth={4}
            ringCount={1}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="label-mono text-text-lo">{attribute.label}</p>
          <p className="mt-0.5 truncate text-xs text-text-lo/80">
            {measured ? attribute.band : "Not yet measured"}
          </p>
        </div>
        <span
          className={cn(
            "font-data shrink-0 text-lg tabular-nums",
            measured ? "text-text-hi" : "text-text-lo/50"
          )}
        >
          {measured ? Math.round(attribute.rating!) : "—"}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-text-lo transition-transform duration-hover",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded ? (
        <div className="well mb-3 space-y-3 rounded-input p-3 text-xs">
          <p className="text-text-hi">{attribute.headline}</p>

          {attribute.recent.length > 0 ? (
            <ul className="space-y-1">
              {attribute.recent.slice(0, 5).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 text-text-lo">
                  <span className="truncate">{ruleLabel(e.ruleKey)}</span>
                  <span className="font-data shrink-0 tabular-nums text-text-hi">
                    {e.points > 0 ? "+" : ""}
                    {e.points}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <AnchorScale anchors={attribute.anchors} raw={attribute.points} color={palette.primary} />

          {attribute.nudge ? (
            <p className="flex items-start gap-1.5 text-ice">
              <RefreshCw className="mt-0.5 size-3 shrink-0" />
              {attribute.nudge}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** The published anchor curve, drawn as a tiny scale with a marker at the real value — never just a number on tap. */
function AnchorScale({
  anchors,
  raw,
  color,
}: {
  anchors: [number, number][];
  raw: number;
  color: string;
}) {
  const lo = anchors[0][0];
  const hi = anchors[anchors.length - 1][0];
  const span = hi - lo || 1;
  const pct = Math.min(100, Math.max(0, ((raw - lo) / span) * 100));

  return (
    <div>
      <div className="relative h-1.5 rounded-full bg-line/60">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%`, background: color }}
        />
        {anchors.map(([x], i) => (
          <span
            key={i}
            className="absolute top-1/2 size-1 -translate-y-1/2 rounded-full bg-bg-1"
            style={{ left: `${Math.min(100, Math.max(0, ((x - lo) / span) * 100))}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-text-lo/70">
        <span>{lo}</span>
        <span className="tabular-nums text-text-hi">{Math.round(raw)}</span>
        <span>{hi}+</span>
      </div>
    </div>
  );
}

function ruleLabel(ruleKey: string): string {
  const labels: Record<string, string> = {
    bounce_uploaded: "Bounce uploaded",
    master_uploaded: "Master uploaded",
    stage_advanced: "Moved forward a stage",
    track_finished: "Track reached final stage",
    track_stalled: "Track sat unfinished 60+ days",
    session_completed: "Focus session completed",
    performance_logged: "Performance logged",
    festival_played: "Festival slot",
    origin_completed: "Artist Origin finished",
    onboarding_checklist_completed: "Getting-started checklist finished",
  };
  return labels[ruleKey] ?? ruleKey;
}
