"use client";

import * as React from "react";
import {
  clampMediaVolume,
  fadeProgress,
} from "@/lib/audio/tempo-theme-bed";

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
  const wantedRef = React.useRef(false);
  const startedRef = React.useRef(false);
  const playPendingRef = React.useRef(false);

  const beginFade = React.useCallback(() => {
    const soundtrack = ref.current;
    if (!soundtrack || !wantedRef.current || startedRef.current) return;

    startedRef.current = true;
    playPendingRef.current = false;
    if (fadeRef.current !== null) cancelAnimationFrame(fadeRef.current);

    const startedAt = performance.now();
    const fadeIn = (now: number) => {
      if (!wantedRef.current) return;
      // Clamp — an unclamped first frame can go slightly negative (rAF `now`
      // vs performance.now()), throw on volume=, and leave the bed silent.
      const progress = fadeProgress(now, startedAt, SOUNDTRACK_FADE_IN_MS);
      soundtrack.volume = clampMediaVolume(SOUNDTRACK_VOLUME * progress);
      if (progress < 1) {
        fadeRef.current = requestAnimationFrame(fadeIn);
      } else {
        fadeRef.current = null;
      }
    };
    fadeRef.current = requestAnimationFrame(fadeIn);
  }, []);

  const tryPlay = React.useCallback(() => {
    const soundtrack = ref.current;
    if (
      !soundtrack ||
      !wantedRef.current ||
      startedRef.current ||
      playPendingRef.current
    ) {
      return;
    }
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }

    soundtrack.loop = true;
    soundtrack.muted = false;
    soundtrack.defaultMuted = false;
    soundtrack.volume = 0;
    playPendingRef.current = true;

    const play = soundtrack.play();
    if (play && typeof play.then === "function") {
      void play.then(beginFade).catch(() => {
        // A cold media element can reject once on macOS. Keep the request
        // armed so canplay, focus, or the next interaction can retry it.
        playPendingRef.current = false;
      });
    } else {
      beginFade();
    }
  }, [beginFade]);

  React.useEffect(() => {
    const soundtrack = ref.current;
    if (!soundtrack) return;

    const retry = () => tryPlay();
    soundtrack.addEventListener("playing", beginFade);
    soundtrack.addEventListener("canplay", retry);
    soundtrack.addEventListener("canplaythrough", retry);
    soundtrack.addEventListener("loadeddata", retry);
    window.addEventListener("pointerdown", retry, { passive: true });
    window.addEventListener("keydown", retry);
    window.addEventListener("focus", retry);
    document.addEventListener("visibilitychange", retry);

    try {
      soundtrack.preload = "auto";
      soundtrack.load();
    } catch {
      /* The opening gesture and readiness listeners still provide retries. */
    }

    // Electron on macOS can miss a readiness event while its window is being
    // restored. A short retry loop covers that race and stops once sound plays.
    const retryTimer = window.setInterval(() => {
      if (wantedRef.current && !startedRef.current) tryPlay();
    }, 350);

    return () => {
      window.clearInterval(retryTimer);
      soundtrack.removeEventListener("playing", beginFade);
      soundtrack.removeEventListener("canplay", retry);
      soundtrack.removeEventListener("canplaythrough", retry);
      soundtrack.removeEventListener("loadeddata", retry);
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("keydown", retry);
      window.removeEventListener("focus", retry);
      document.removeEventListener("visibilitychange", retry);
    };
  }, [beginFade, tryPlay]);

  const start = React.useCallback(() => {
    wantedRef.current = true;
    if (fadeRef.current !== null) {
      cancelAnimationFrame(fadeRef.current);
      fadeRef.current = null;
    }
    tryPlay();
  }, [tryPlay]);

  const fade = React.useCallback(() => {
    const soundtrack = ref.current;
    if (!soundtrack || soundtrack.paused) return;
    if (fadeRef.current !== null) cancelAnimationFrame(fadeRef.current);

    const startedAt = performance.now();
    const startVolume = clampMediaVolume(soundtrack.volume);
    const fadeOut = (now: number) => {
      const progress = fadeProgress(now, startedAt, SOUNDTRACK_FADE_OUT_MS);
      soundtrack.volume = clampMediaVolume(startVolume * (1 - progress));
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
    wantedRef.current = false;
    startedRef.current = false;
    playPendingRef.current = false;
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
      wantedRef.current = false;
      startedRef.current = false;
      playPendingRef.current = false;
      if (fadeRef.current !== null) cancelAnimationFrame(fadeRef.current);
      ref.current?.pause();
    },
    []
  );

  return { ref, start, fade, reset };
}
