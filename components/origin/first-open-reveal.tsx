"use client";

import * as React from "react";
import { ORIGIN_MEDIA } from "@/lib/origin/media";
import { SUPPRESS_INTRO_KEY } from "@/lib/intro";

/**
 * The seam between ORIGIN and the product.
 *
 * Origin ends on the chapter's final frame; the real app mounts underneath an
 * overlay holding that exact image. Spectra-like light slits assemble across
 * it while the frame opens away, so the workspace feels formed out of the film
 * instead of arriving by a plain fade.
 *
 * One session only — the flag is cleared on first use, so a refresh or any
 * later navigation goes straight to the app.
 */

export const FIRST_OPEN_FLAG = "tempo.originFirstOpen";
/** Suppresses the daily boot intro so two introductions never stack up. */
export const SUPPRESS_INTRO_FLAG = SUPPRESS_INTRO_KEY;

const ARRIVAL_MS = 1500;

export function markFirstOpenPending() {
  try {
    sessionStorage.setItem(FIRST_OPEN_FLAG, "1");
    sessionStorage.setItem(SUPPRESS_INTRO_FLAG, "1");
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

/**
 * Mounted by the authenticated shell. Renders nothing at all unless this
 * session just came out of Origin.
 */
export function FirstOpenReveal() {
  const [phase, setPhase] = React.useState<"idle" | "running" | "done">("idle");
  const ranRef = React.useRef(false);

  React.useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    if (!consumeFirstOpenFlag()) {
      setPhase("done");
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("running");
      const t = setTimeout(() => setPhase("done"), 180);
      return () => clearTimeout(t);
    }
    setPhase("running");
    const toDone = setTimeout(() => setPhase("done"), ARRIVAL_MS);
    return () => clearTimeout(toDone);
  }, []);

  if (phase === "done" || phase === "idle") return null;

  return (
    <div aria-hidden className="origin-first-open pointer-events-none fixed inset-0 z-[100]">
      <div
        className="origin-first-open__frame absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${ORIGIN_MEDIA.scroll06.finalPoster ?? ORIGIN_MEDIA.scroll06.poster})`,
        }}
      />
      <div className="origin-first-open__veil absolute inset-0" />
      <div className="absolute inset-0 overflow-hidden mix-blend-screen">
        {[9, 18, 29, 43, 57, 68, 79, 90].map((left, index) => (
          <span
            key={left}
            className="origin-first-open__slit absolute inset-y-0"
            style={
              {
                left: `${left}%`,
                animationDelay: `${index * 45}ms`,
                "--origin-arrival-color":
                  index % 3 === 0
                    ? "var(--ice)"
                    : index % 3 === 1
                      ? "rgba(255,255,255,0.9)"
                      : "var(--amber)",
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
