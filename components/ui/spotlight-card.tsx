"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Cursor-tracked spotlight for selectable surfaces (tracks, projects, tasks).
 *
 * Adapted from a generic glow-card. Two deliberate departures from the
 * original:
 *
 * 1. No hue rotation. The original swept 200–300° of hue with pointer-X,
 *    which produces rainbow and fights Spectra. Here the halo is pinned to a
 *    palette token and the moving highlight is a white core — the same
 *    ice → white → amber reading as `.flare-line`.
 * 2. One pointer listener for the whole page instead of one per card, and
 *    the CSS lives in globals.css rather than an injected <style> per
 *    instance. A board with twenty cards used to mean twenty of each.
 *
 * Edge glow uses **local** `--spot-x` / `--spot-y` (not `background-attachment:
 * fixed`) so Board columns with `transform` / `overflow` still light up the
 * same way as Tracks rows.
 */

type SpotlightTone = "ramp" | "ice" | "amber" | "violet" | "ok" | "warn";

const TONE_VAR: Record<SpotlightTone, string> = {
  /**
   * Hue travels with the pointer across the product's own ramp —
   * ice → white → amber, the same progression as `.flare-line` and the board's
   * stage hues. This is the "hue rotation" of the original component, fenced
   * to the palette so it can never wander into greens or magentas.
   */
  ramp: "var(--spot-ramp)",
  ice: "var(--ice)",
  amber: "var(--amber)",
  violet: "var(--violet)",
  ok: "var(--ok)",
  warn: "var(--warn)",
};

/* ------------------------------------------------------------------ */
/* Shared pointer tracking                                             */
/* ------------------------------------------------------------------ */

let subscribers = 0;
let rafId: number | null = null;
let pending: { x: number; y: number } | null = null;

function flush() {
  rafId = null;
  if (!pending) return;
  const root = document.documentElement;
  root.style.setProperty("--pointer-x", pending.x.toFixed(1));
  root.style.setProperty("--pointer-y", pending.y.toFixed(1));
  // 0 → 1 across the viewport, drives the ice → white → amber ramp.
  root.style.setProperty(
    "--pointer-xp",
    (pending.x / Math.max(1, window.innerWidth)).toFixed(3)
  );
  pending = null;
}

function onPointerMove(e: PointerEvent) {
  pending = { x: e.clientX, y: e.clientY };
  // Coalesce to one write per frame — pointermove fires far faster than paint.
  if (rafId == null) rafId = requestAnimationFrame(flush);
}

/**
 * Registers the page-level pointer listener. Ref-counted, so it attaches on
 * the first spotlight card mounted and detaches when the last unmounts.
 */
function useSpotlightPointer() {
  React.useEffect(() => {
    subscribers += 1;
    if (subscribers === 1) {
      document.addEventListener("pointermove", onPointerMove, {
        passive: true,
      });
    }
    return () => {
      subscribers -= 1;
      if (subscribers === 0) {
        document.removeEventListener("pointermove", onPointerMove);
        if (rafId != null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      }
    };
  }, []);
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export type SpotlightCardProps = {
  children: React.ReactNode;
  id?: string;
  className?: string;
  /** Palette token driving the halo. Defaults to ice (interactive). */
  tone?: SpotlightTone;
  /** Optional exact accent, used by user-configurable category palettes. */
  accent?: string;
  /** Corner radius in px — match the surface it wraps. */
  radius?: number;
  /** Border thickness of the lit edge, in px. */
  borderWidth?: number;
  /** Spotlight diameter in px. Larger = softer, more ambient. */
  size?: number;
  /** Adds a faint interior wash as well as the lit edge. */
  fill?: boolean;
  /** Render as something other than a div (e.g. "li"). */
  as?: "div" | "li" | "article" | "section";
};

export function SpotlightCard({
  children,
  id,
  className,
  tone = "ramp",
  accent,
  radius = 16,
  borderWidth = 1.5,
  size = 220,
  fill = true,
  as: Tag = "div",
}: SpotlightCardProps) {
  useSpotlightPointer();

  const syncLocalSpot = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const el = event.currentTarget;
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
      el.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
    },
    []
  );

  return (
    <Tag
      id={id}
      className={cn("spotlight", className)}
      onPointerEnter={syncLocalSpot}
      onPointerMove={syncLocalSpot}
      style={
        {
          "--spot-color": accent ?? TONE_VAR[tone],
          "--spot-radius": radius,
          "--spot-border": borderWidth,
          "--spot-size": size,
          "--spot-x": "50%",
          "--spot-y": "50%",
        } as React.CSSProperties
      }
    >
      {fill ? (
        <span
          aria-hidden
          className="spotlight-fill pointer-events-none absolute inset-0"
          style={{ borderRadius: `${radius}px` }}
        />
      ) : null}
      {children}
    </Tag>
  );
}
