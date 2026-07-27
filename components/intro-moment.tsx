"use client";

import * as React from "react";
import { setIntroActive } from "@/lib/lightfield";
import { LfWindow } from "@/components/lf-windows";
import { cn } from "@/lib/utils";

const INTRO_KEY = "tempo.introPlayed";

/**
 * Boot intro over the root Lightfield (no extra WebGL context).
 * Full-bleed field visible through punched chrome, then scale-Y collapse
 * into the top edge. Once per session; skipped under prefers-reduced-motion.
 */
export function IntroMoment({
  onDone,
}: {
  onDone?: () => void;
}) {
  const [phase, setPhase] = React.useState<
    "skip" | "play" | "collapse" | "done"
  >("skip");

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("done");
      onDone?.();
      return;
    }
    try {
      if (sessionStorage.getItem(INTRO_KEY) === "1") {
        setPhase("done");
        onDone?.();
        return;
      }
    } catch {
      /* private mode */
    }
    setPhase("play");
  }, [onDone]);

  React.useEffect(() => {
    if (phase === "play" || phase === "collapse") {
      setIntroActive(true);
      return () => setIntroActive(false);
    }
    setIntroActive(false);
  }, [phase]);

  React.useEffect(() => {
    if (phase !== "play") return;
    const t = window.setTimeout(() => setPhase("collapse"), 1200);
    return () => window.clearTimeout(t);
  }, [phase]);

  React.useEffect(() => {
    if (phase !== "collapse") return;
    const t = window.setTimeout(() => {
      try {
        sessionStorage.setItem(INTRO_KEY, "1");
      } catch {
        /* ignore */
      }
      setPhase("done");
      onDone?.();
    }, 550);
    return () => window.clearTimeout(t);
  }, [phase, onDone]);

  if (phase === "skip" || phase === "done") return null;

  return (
    <div
      data-lf-intro-layer
      className={cn(
        "pointer-events-none fixed inset-0 z-[300] flex items-center justify-center overflow-hidden",
        phase === "collapse" &&
          "origin-center transition-transform duration-drawer ease-out"
      )}
      style={
        phase === "collapse"
          ? { transform: "scaleY(0.018)", opacity: 0.9 }
          : undefined
      }
      aria-hidden
    >
      {/* Scrim only — light comes from the root Lightfield behind chrome */}
      <div className="absolute inset-0 bg-bg-0/55" />
      <span
        className={cn(
          "relative z-10 font-display text-5xl font-bold tracking-tight text-text-hi sm:text-7xl",
          phase === "collapse" && "opacity-0 transition-opacity duration-hover"
        )}
      >
        TEMPO
      </span>
    </div>
  );
}

/** Top edge Lightfield window strip (height via --edge-strip-h). */
export function EdgeStrip() {
  return (
    <LfWindow className="edge-strip lf-window sticky top-0 z-50 shrink-0" aria-hidden />
  );
}
