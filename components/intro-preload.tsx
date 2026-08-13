"use client";

import * as React from "react";
import { INTRO_SOURCES, introWillPlay } from "@/lib/intro";

/**
 * Warms the intro video into the media cache while you're on the sign-in
 * screen, so the boot moment on the other side of login starts instantly
 * instead of stalling on first buffer.
 *
 * Detached <video> rather than <link rel="preload"> — `as="video"` isn't a
 * real preload destination, and only a media element actually fills the
 * media cache. Skipped when the intro wouldn't play anyway, so nobody pays
 * for bytes they'll never see.
 *
 * Starts only after the Tempo Theme bed is ready (or a short timeout), so the
 * ~2.7MB soundtrack isn't competing with the intro film on first paint.
 */
export function IntroPreload() {
  const elRef = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    if (!introWillPlay()) return;

    let cancelled = false;
    let idleHandle: number | null = null;
    let fallbackTimer: number | null = null;

    const warm = () => {
      if (cancelled || elRef.current) return;
      const v = document.createElement("video");
      v.preload = "auto";
      v.muted = true;
      v.playsInline = true;
      for (const s of INTRO_SOURCES) {
        const source = document.createElement("source");
        source.src = s.src;
        source.type = s.type;
        v.appendChild(source);
      }
      // Held in a ref so it isn't collected before the fetch completes.
      elRef.current = v;
      v.load();
    };

    const scheduleWarm = () => {
      if (cancelled || elRef.current) return;
      const ric = (
        window as Window & {
          requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
        }
      ).requestIdleCallback;
      if (typeof ric === "function") {
        idleHandle = ric(warm, { timeout: 1500 });
      } else {
        idleHandle = window.setTimeout(warm, 200);
      }
    };

    const onThemeReady = () => {
      if (fallbackTimer != null) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      scheduleWarm();
    };

    window.addEventListener("tempo-theme-ready", onThemeReady);
    // Don't block intro forever if the bed is muted / blocked.
    fallbackTimer = window.setTimeout(onThemeReady, 2500);

    return () => {
      cancelled = true;
      window.removeEventListener("tempo-theme-ready", onThemeReady);
      if (fallbackTimer != null) window.clearTimeout(fallbackTimer);
      const cic = (
        window as Window & { cancelIdleCallback?: (h: number) => void }
      ).cancelIdleCallback;
      const ric = (
        window as Window & {
          requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
        }
      ).requestIdleCallback;
      if (idleHandle != null) {
        if (typeof ric === "function" && typeof cic === "function") {
          cic(idleHandle);
        } else {
          window.clearTimeout(idleHandle);
        }
      }
      const v = elRef.current;
      if (v) {
        v.removeAttribute("src");
        while (v.firstChild) v.removeChild(v.firstChild);
        v.load();
        elRef.current = null;
      }
    };
  }, []);

  return null;
}
