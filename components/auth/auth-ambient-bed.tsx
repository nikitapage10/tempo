"use client";

import * as React from "react";
import {
  TEMPO_THEME_SRC,
  TEMPO_THEME_VOLUME,
  TEMPO_THEME_FADE_IN_MS,
  fadeAudioTo,
  stopTempoThemeBed,
} from "@/lib/audio/tempo-theme-bed";
import { isDesktopApp } from "@/lib/desktop/bridge";

/**
 * Quiet Tempo Theme bed under login / register.
 *
 * Not once-a-day — that gate is only the post-login boot film. This bed should
 * start every time AuthShell mounts (logout → login, quit → reopen, etc.).
 *
 * Browsers need a click/key before autoplay; TEMPO Desktop already sets
 * Chromium's no-gesture autoplay policy. We only lock "started" after play()
 * succeeds, reset that flag on cleanup (Strict Mode), and keep retrying while
 * the file buffers — cached revisits often fire canplay before listeners land.
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
    if (reduced) return;

    const desktop = isDesktopApp();
    let cancelled = false;
    /** Web needs a gesture; desktop is unlocked immediately. */
    let unlocked = desktop;
    let retryTimer: number | null = null;

    const clearMediaListeners = () => {
      audio.removeEventListener("canplay", tryStart);
      audio.removeEventListener("canplaythrough", tryStart);
      audio.removeEventListener("loadeddata", tryStart);
    };

    const clearGestureListeners = () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      window.removeEventListener("focus", tryStart);
      document.removeEventListener("visibilitychange", onVisibility);
    };

    const clearAllListeners = () => {
      clearMediaListeners();
      clearGestureListeners();
      if (retryTimer != null) {
        window.clearInterval(retryTimer);
        retryTimer = null;
      }
    };

    const onPlaying = () => {
      if (cancelled || startedRef.current) return;
      startedRef.current = true;
      cancelFadeRef.current?.();
      cancelFadeRef.current = fadeAudioTo(
        audio,
        TEMPO_THEME_VOLUME,
        TEMPO_THEME_FADE_IN_MS
      );
      clearAllListeners();
      try {
        window.dispatchEvent(new Event("tempo-theme-ready"));
      } catch {
        /* ignore */
      }
    };

    const tryStart = () => {
      if (cancelled || startedRef.current || !unlocked) return;
      // Wait until we have something to play — don't require the whole 2.7MB.
      if (audio.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

      cancelFadeRef.current?.();
      cancelFadeRef.current = null;
      audio.loop = true;
      audio.volume = 0;

      const play = audio.play();
      if (play && typeof play.then === "function") {
        play.then(onPlaying).catch(() => {
          // Keep retrying — desktop after logout often rejects once then works.
        });
      } else {
        onPlaying();
      }
    };

    const onGesture = () => {
      unlocked = true;
      tryStart();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") tryStart();
    };

    window.addEventListener("pointerdown", onGesture, { passive: true });
    window.addEventListener("keydown", onGesture);
    window.addEventListener("focus", tryStart);
    document.addEventListener("visibilitychange", onVisibility);

    audio.addEventListener("canplay", tryStart);
    audio.addEventListener("canplaythrough", tryStart);
    audio.addEventListener("loadeddata", tryStart);

    // Warm the file ASAP so a web gesture isn't waiting on a cold 2.7MB fetch.
    const preloadLink = document.createElement("link");
    preloadLink.rel = "preload";
    preloadLink.as = "audio";
    preloadLink.href = TEMPO_THEME_SRC;
    preloadLink.type = "audio/mpeg";
    document.head.appendChild(preloadLink);

    try {
      audio.preload = "auto";
      audio.load();
    } catch {
      /* ignore */
    }

    // Cached / already-ready media: canplay may never fire again after load().
    tryStart();
    queueMicrotask(tryStart);

    // Desktop (and web after unlock): poll briefly so logout→login / reopen
    // still starts when the readyState race skips the media events.
    retryTimer = window.setInterval(() => {
      if (cancelled || startedRef.current) {
        if (retryTimer != null) {
          window.clearInterval(retryTimer);
          retryTimer = null;
        }
        return;
      }
      tryStart();
    }, 300);

    return () => {
      cancelled = true;
      clearAllListeners();
      cancelFadeRef.current?.();
      cancelFadeRef.current = null;
      // Strict Mode re-runs effects on the same instance — without this the
      // first run's successful play leaves started=true and the remount never
      // calls play() again after cleanup paused the element.
      startedRef.current = false;
      preloadLink.remove();
      void stopTempoThemeBed(audio);
    };
  }, []);

  return (
    <audio
      ref={audioRef}
      src={TEMPO_THEME_SRC}
      preload="auto"
      loop
      playsInline
      aria-hidden
    />
  );
}
