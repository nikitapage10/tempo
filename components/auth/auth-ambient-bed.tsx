"use client";

import * as React from "react";
import {
  TEMPO_THEME_SRC,
  startTempoThemeBed,
  stopTempoThemeBed,
} from "@/lib/audio/tempo-theme-bed";

/**
 * Quiet Tempo Theme bed under login / register. Starts on the first pointer
 * or key gesture (autoplay policy), fades out when the shell unmounts.
 */
export function AuthAmbientBed() {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const startedRef = React.useRef(false);
  const cancelFadeRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const start = () => {
      if (startedRef.current || reduced) return;
      startedRef.current = true;
      cancelFadeRef.current?.();
      cancelFadeRef.current = startTempoThemeBed(audio) ?? null;
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
    };

    window.addEventListener("pointerdown", start, { passive: true });
    window.addEventListener("keydown", start);

    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
      cancelFadeRef.current?.();
      void stopTempoThemeBed(audio);
    };
  }, []);

  return (
    <audio
      ref={audioRef}
      src={TEMPO_THEME_SRC}
      preload="auto"
      loop
      aria-hidden
    />
  );
}
