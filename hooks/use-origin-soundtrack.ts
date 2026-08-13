"use client";

import * as React from "react";

/**
 * The quiet Tempo Theme bed that runs under the onboarding film.
 *
 * Shared by ORIGIN and PASSAGE so the two arrivals sound identical — the
 * fades are tuned against the film's own cuts, and a second hand-rolled copy
 * would drift out of step with them.
 *
 * Playback must begin inside the opening "Tune in" gesture: browsers refuse
 * audible playback on a page that has had no user interaction, and the file is
 * primed on mount so that `play()` does not have to wait on its first network
 * read once that gesture arrives.
 */

export const SOUNDTRACK_SRC = "/onboarding/origin/tempo-theme.mp3";
/** Loud enough to feel, soft enough to stay behind the copy. */
const SOUNDTRACK_VOLUME = 0.19;
const SOUNDTRACK_FADE_IN_MS = 1400;
const SOUNDTRACK_FADE_OUT_MS = 1100;

export type OriginSoundtrack = {
  ref: React.MutableRefObject<HTMLAudioElement | null>;
  /** Call inside the user gesture, so the first play() is already allowed audio. */
  start: () => void;
  /** Lets the bed leave with the film rather than stopping dead at navigation. */
  fade: () => void;
  /** Returning to the waking screen puts the bed back to silence. */
  reset: () => void;
};

export function useOriginSoundtrack(): OriginSoundtrack {
  const ref = React.useRef<HTMLAudioElement | null>(null);
  const fadeRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    ref.current?.load();
  }, []);

  const start = React.useCallback(() => {
    const soundtrack = ref.current;
    if (!soundtrack) return;
    if (fadeRef.current !== null) {
      cancelAnimationFrame(fadeRef.current);
      fadeRef.current = null;
    }
    soundtrack.loop = true;
    soundtrack.volume = 0;
    void soundtrack
      .play()
      .then(() => {
        const startedAt = performance.now();
        const fadeIn = (now: number) => {
          const progress = Math.min(1, (now - startedAt) / SOUNDTRACK_FADE_IN_MS);
          soundtrack.volume = SOUNDTRACK_VOLUME * progress;
          if (progress < 1) {
            fadeRef.current = requestAnimationFrame(fadeIn);
          } else {
            fadeRef.current = null;
          }
        };
        fadeRef.current = requestAnimationFrame(fadeIn);
      })
      .catch(() => {
        // If a browser still refuses playback, the visual flow remains usable.
      });
  }, []);

  const fade = React.useCallback(() => {
    const soundtrack = ref.current;
    if (!soundtrack || soundtrack.paused) return;
    if (fadeRef.current !== null) cancelAnimationFrame(fadeRef.current);

    const startedAt = performance.now();
    const startVolume = soundtrack.volume;
    const fadeOut = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / SOUNDTRACK_FADE_OUT_MS);
      soundtrack.volume = startVolume * (1 - progress);
      if (progress < 1) {
        fadeRef.current = requestAnimationFrame(fadeOut);
      } else {
        soundtrack.pause();
        fadeRef.current = null;
      }
    };
    fadeRef.current = requestAnimationFrame(fadeOut);
  }, []);

  const reset = React.useCallback(() => {
    if (fadeRef.current !== null) {
      cancelAnimationFrame(fadeRef.current);
      fadeRef.current = null;
    }
    const soundtrack = ref.current;
    if (soundtrack) {
      soundtrack.pause();
      soundtrack.currentTime = 0;
      soundtrack.volume = 0;
    }
  }, []);

  React.useEffect(
    () => () => {
      if (fadeRef.current !== null) cancelAnimationFrame(fadeRef.current);
      ref.current?.pause();
    },
    []
  );

  return { ref, start, fade, reset };
}
