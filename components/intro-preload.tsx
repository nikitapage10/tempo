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
 */
export function IntroPreload() {
  const elRef = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    if (!introWillPlay()) return;

    let cancelled = false;
    let idleHandle: number | null = null;

    const warm = () => {
      if (cancelled) return;
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

    // Let the sign-in screen finish its own work first.
    const ric = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      }
    ).requestIdleCallback;
    if (typeof ric === "function") {
      idleHandle = ric(warm, { timeout: 2000 });
    } else {
      idleHandle = window.setTimeout(warm, 300);
    }

    return () => {
      cancelled = true;
      const cic = (
        window as Window & { cancelIdleCallback?: (h: number) => void }
      ).cancelIdleCallback;
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
