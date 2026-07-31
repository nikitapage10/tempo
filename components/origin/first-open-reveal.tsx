"use client";

import * as React from "react";
import { ORIGIN_MEDIA } from "@/lib/origin/media";
import { SUPPRESS_INTRO_KEY } from "@/lib/intro";

/**
 * The seam between ORIGIN and the product.
 *
 * Origin ends on the chapter's final frame; the real app mounts underneath an
 * opaque layer showing that same image, which then fades to deep black and
 * away. The artist never sees a hard cut into a half-rendered workspace.
 *
 * One session only — the flag is cleared on first use, so a refresh or any
 * later navigation goes straight to the app.
 */

export const FIRST_OPEN_FLAG = "tempo.originFirstOpen";
/** Suppresses the daily boot intro so two introductions never stack up. */
export const SUPPRESS_INTRO_FLAG = SUPPRESS_INTRO_KEY;

const REVEAL_MS = 850;
const HOLD_MS = 260;

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
  const [phase, setPhase] = React.useState<"idle" | "image" | "black" | "done">("idle");
  const ranRef = React.useRef(false);

  React.useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    if (!consumeFirstOpenFlag()) {
      setPhase("done");
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // A short opacity change rather than a staged reveal.
      setPhase("black");
      const t = setTimeout(() => setPhase("done"), 200);
      return () => clearTimeout(t);
    }
    setPhase("image");
    const toBlack = setTimeout(() => setPhase("black"), HOLD_MS);
    const toDone = setTimeout(() => setPhase("done"), HOLD_MS + REVEAL_MS);
    return () => {
      clearTimeout(toBlack);
      clearTimeout(toDone);
    };
  }, []);

  if (phase === "done" || phase === "idle") return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] bg-[var(--bg-0)]"
      style={{
        opacity: phase === "black" ? 0 : 1,
        transition: `opacity ${REVEAL_MS}ms ease-out`,
      }}
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${ORIGIN_MEDIA.scroll06.poster})`,
          opacity: phase === "image" ? 1 : 0,
          transition: `opacity ${REVEAL_MS * 0.7}ms ease-out`,
        }}
      />
    </div>
  );
}
