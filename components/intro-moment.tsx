"use client";

import * as React from "react";
import { ShaderLines } from "@/components/shader-lines";
import { cn } from "@/lib/utils";

const INTRO_KEY = "tempo.introPlayed";

/**
 * Full-bleed shader behind TEMPO wordmark for ~1.2s, then scale-Y collapse
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
      className={cn(
        "pointer-events-none fixed inset-0 z-[300] flex items-center justify-center overflow-hidden bg-bg-0",
        phase === "collapse" &&
          "origin-center transition-transform duration-drawer ease-out"
      )}
      style={
        phase === "collapse"
          ? { transform: "scaleY(0.004)", opacity: 0.9 }
          : undefined
      }
      aria-hidden
    >
      <div className="absolute inset-0">
        <ShaderLines className="h-full w-full" intensity={1.2} speed={1.1} />
      </div>
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

/** Desktop: thin animated shader strip. Mobile: static gradient (battery). */
export function EdgeStrip() {
  const [desktop, setDesktop] = React.useState(false);
  const [reduced, setReduced] = React.useState(true);

  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setDesktop(mq.matches);
      setReduced(motion.matches);
    };
    sync();
    mq.addEventListener("change", sync);
    motion.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      motion.removeEventListener("change", sync);
    };
  }, []);

  if (!desktop || reduced) {
    return <div className="edge-strip sticky top-0 z-50" aria-hidden />;
  }

  return (
    <div
      className="sticky top-0 z-50 h-[3px] w-full overflow-hidden opacity-40"
      aria-hidden
    >
      <div className="h-[120px] w-full -translate-y-[58px]">
        <ShaderLines className="h-full w-full" intensity={0.9} speed={0.7} />
      </div>
    </div>
  );
}
