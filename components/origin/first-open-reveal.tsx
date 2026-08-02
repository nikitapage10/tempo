"use client";

import * as React from "react";
import {
  ORIGIN_ARRIVAL_KEY,
  SUPPRESS_INTRO_KEY,
} from "@/lib/intro";

/**
 * The seam between ORIGIN and the product.
 *
 * The real app mounts behind an opaque pre-paint floor. Spectra-like vertical
 * light bars rise from the bottom, then the floor dissolves to reveal the
 * workspace. The pre-paint guard and mounted overlay overlap by one animation
 * frame, so the dashboard can never flash before the transition begins.
 *
 * One session only — the flag is cleared on first use, so a refresh or any
 * later navigation goes straight to the app.
 */

export const FIRST_OPEN_FLAG = ORIGIN_ARRIVAL_KEY;
/** Suppresses the daily boot intro so two introductions never stack up. */
export const SUPPRESS_INTRO_FLAG = SUPPRESS_INTRO_KEY;

const ARRIVAL_MS = 2100;

const ARRIVAL_BARS = [
  { left: 3, height: 48, width: 2, delay: 240, tone: "ice" },
  { left: 8, height: 76, width: 1, delay: 90, tone: "white" },
  { left: 13, height: 58, width: 3, delay: 330, tone: "amber" },
  { left: 19, height: 88, width: 1, delay: 150, tone: "ice" },
  { left: 24, height: 66, width: 2, delay: 390, tone: "white" },
  { left: 30, height: 94, width: 3, delay: 40, tone: "amber" },
  { left: 36, height: 72, width: 1, delay: 280, tone: "ice" },
  { left: 41, height: 100, width: 2, delay: 110, tone: "white" },
  { left: 47, height: 82, width: 4, delay: 210, tone: "ice" },
  { left: 53, height: 96, width: 2, delay: 20, tone: "amber" },
  { left: 58, height: 68, width: 1, delay: 360, tone: "white" },
  { left: 63, height: 90, width: 3, delay: 130, tone: "ice" },
  { left: 69, height: 62, width: 2, delay: 420, tone: "amber" },
  { left: 75, height: 84, width: 1, delay: 180, tone: "white" },
  { left: 80, height: 54, width: 3, delay: 310, tone: "ice" },
  { left: 87, height: 92, width: 2, delay: 70, tone: "amber" },
  { left: 93, height: 70, width: 1, delay: 260, tone: "white" },
] as const;

export function markFirstOpenPending() {
  try {
    sessionStorage.setItem(FIRST_OPEN_FLAG, "1");
    sessionStorage.setItem(SUPPRESS_INTRO_FLAG, "1");
    document.documentElement.classList.add("origin-arrival-pending");
  } catch {
    /* private mode — the reveal is a nicety, not a requirement */
  }
}

export function consumeFirstOpenFlag(): boolean {
  try {
    if (sessionStorage.getItem(FIRST_OPEN_FLAG) !== "1") return false;
    sessionStorage.removeItem(FIRST_OPEN_FLAG);
    return true;
  } catch {
    return false;
  }
}

export function isBootIntroSuppressed(): boolean {
  try {
    return sessionStorage.getItem(SUPPRESS_INTRO_FLAG) === "1";
  } catch {
    return false;
  }
}

export function clearBootIntroSuppression() {
  try {
    sessionStorage.removeItem(SUPPRESS_INTRO_FLAG);
  } catch {
    /* nothing to clear */
  }
}

/** Mounted by the authenticated shell; idle in every non-ORIGIN session. */
export function FirstOpenReveal() {
  const [phase, setPhase] = React.useState<"idle" | "running" | "done">("idle");
  const claimedRef = React.useRef<boolean | null>(null);

  React.useEffect(() => {
    // Keep the claim in a ref so React Strict Mode can safely restart this
    // effect without consuming the one-shot session flag twice.
    if (claimedRef.current === null) {
      claimedRef.current = consumeFirstOpenFlag();
    }
    if (!claimedRef.current) {
      document.documentElement.classList.remove("origin-arrival-pending");
      setPhase("done");
      return;
    }

    setPhase("running");

    // Keep the class-backed pre-paint cover until the mounted overlay has
    // reached a painted frame. Removing it earlier causes the dashboard flash.
    let innerRaf = 0;
    const coverRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => {
        document.documentElement.classList.remove("origin-arrival-pending");
      });
    });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const toDone = window.setTimeout(() => {
      document.documentElement.classList.remove("origin-arrival-pending");
      setPhase("done");
    }, reduced ? 180 : ARRIVAL_MS);

    return () => {
      cancelAnimationFrame(coverRaf);
      cancelAnimationFrame(innerRaf);
      clearTimeout(toDone);
    };
  }, []);

  if (phase === "done" || phase === "idle") return null;

  return (
    <div
      aria-hidden
      className="origin-first-open pointer-events-none fixed inset-0 z-[400] overflow-hidden bg-bg-0"
    >
      <div className="origin-first-open__ground absolute inset-x-0 bottom-0 h-[58vh]" />
      <div className="origin-first-open__bars absolute inset-0">
        {ARRIVAL_BARS.map((bar, index) => (
          <span
            key={index}
            className={`origin-first-open__bar origin-first-open__bar--${bar.tone}`}
            style={{
              left: `${bar.left}%`,
              height: `${bar.height}vh`,
              width: `${bar.width}px`,
              animationDelay: `${bar.delay}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
