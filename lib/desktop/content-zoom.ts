/**
 * Desktop content zoom — scales the main workspace, not the left rail's
 * hit-target chrome. Native Electron page zoom (setZoomFactor) is forced to
 * 1.0 so window chrome stays stable.
 *
 * When the labeled (xl) rail has room, menu type can grow with content zoom
 * up to RAIL_TYPE_ZOOM_MAX; the compact icon rail never scales.
 *
 * The first-run default is display-aware: 1x high-resolution Windows screens
 * (1440p, ultrawide) start above 100%, while Retina / 150%+ OS scaling stays
 * at 100% because CSS pixels are already enlarged.
 */

export const CONTENT_ZOOM_MIN = 0.5;
export const CONTENT_ZOOM_MAX = 2.0;
export const CONTENT_ZOOM_STEP = 0.1;
/** Labeled rail type/scale ceiling — grows with zoom only while there's width. */
export const RAIL_TYPE_ZOOM_MAX = 1.35;
export const RAIL_LABELED_WIDTH_PX = 220;
export const RAIL_COMPACT_WIDTH_PX = 68;
export const CONTENT_ZOOM_STORAGE_KEY = "tempo.contentZoom";
export const CONTENT_ZOOM_EVENT = "tempo:content-zoom";
/** Bumped when the implicit 100% default is replaced so old 1.0 prefs migrate. */
export const CONTENT_ZOOM_DEFAULT_GEN = 3;
export const CONTENT_ZOOM_DEFAULT_GEN_KEY = "tempo.contentZoom.defaultGen";

export type DisplayMetrics = {
  devicePixelRatio: number;
  screenWidth: number;
  screenHeight: number;
};

export function clampContentZoom(value: number): number {
  if (!Number.isFinite(value)) return 1;
  const stepped = Math.round(value * 10) / 10;
  return Math.min(CONTENT_ZOOM_MAX, Math.max(CONTENT_ZOOM_MIN, stepped));
}

function readDisplayMetrics(): DisplayMetrics {
  if (typeof window === "undefined") {
    return { devicePixelRatio: 1, screenWidth: 0, screenHeight: 0 };
  }
  return {
    devicePixelRatio: window.devicePixelRatio || 1,
    screenWidth: window.screen?.width ?? 0,
    screenHeight: window.screen?.height ?? 0,
  };
}

/**
 * Suggested first-run / reset zoom for this display. Pure so tests can pass
 * metrics without stubbing `window`.
 */
export function suggestedContentZoom(
  metrics: DisplayMetrics = readDisplayMetrics()
): number {
  const dpr = metrics.devicePixelRatio || 1;
  const width = metrics.screenWidth || 0;
  const height = metrics.screenHeight || 0;

  // OS already scaling CSS pixels (Mac Retina, Windows 150% / 200%).
  if (dpr >= 1.5) return 1;

  // Windows 125%: CSS is already a quarter larger — only a modest extra bump
  // on very large desktops, otherwise a single step.
  if (dpr >= 1.25) {
    if (width >= 3000 || height >= 1320) return 1.2;
    if (width >= 1920 || height >= 1080) return 1.1;
    return 1;
  }

  // ~1x: 1440p / ultrawide CSS pixels are physically small.
  if (width >= 3000 && height >= 1320) return 1.4;
  if (height >= 1320 || width >= 3000) return 1.3;
  if (height >= 1080 || width >= 1920) return 1.2;
  return 1;
}

export function defaultContentZoom(): number {
  return clampContentZoom(suggestedContentZoom());
}

/** Scale for labeled-rail type when content zoom is up; 1 for compact rail. */
export function railTypeZoom(contentZoom: number, labeledRail: boolean): number {
  if (!labeledRail) return 1;
  const z = clampContentZoom(contentZoom);
  if (z <= 1) return 1;
  return Math.min(z, RAIL_TYPE_ZOOM_MAX);
}

export function railLayoutWidthPx(
  contentZoom: number,
  labeledRail: boolean
): number {
  if (!labeledRail) return RAIL_COMPACT_WIDTH_PX;
  const scale = railTypeZoom(contentZoom, true);
  return Math.round(RAIL_LABELED_WIDTH_PX * scale);
}

export function readContentZoom(): number {
  if (typeof window === "undefined") return 1;
  try {
    const raw = window.localStorage.getItem(CONTENT_ZOOM_STORAGE_KEY);
    const gen = Number(
      window.localStorage.getItem(CONTENT_ZOOM_DEFAULT_GEN_KEY) ?? 0
    );
    if (raw != null && raw !== "") {
      const stored = clampContentZoom(Number(raw));
      // Keep a real choice, including an explicit 100% after this generation.
      if (stored !== 1 || gen >= CONTENT_ZOOM_DEFAULT_GEN) return stored;
    }
    return writeContentZoom(defaultContentZoom());
  } catch {
    return defaultContentZoom();
  }
}

export function writeContentZoom(factor: number): number {
  const next = clampContentZoom(factor);
  if (typeof window === "undefined") return next;
  try {
    window.localStorage.setItem(CONTENT_ZOOM_STORAGE_KEY, String(next));
    window.localStorage.setItem(
      CONTENT_ZOOM_DEFAULT_GEN_KEY,
      String(CONTENT_ZOOM_DEFAULT_GEN)
    );
  } catch {
    /* ignore quota */
  }
  window.dispatchEvent(
    new CustomEvent<number>(CONTENT_ZOOM_EVENT, { detail: next })
  );
  return next;
}

/** delta 0 resets to the display default, not hardcoded 100%. */
export function nudgeContentZoom(delta: number): number {
  if (delta === 0) return writeContentZoom(defaultContentZoom());
  return writeContentZoom(readContentZoom() + delta);
}

export function subscribeContentZoom(
  listener: (factor: number) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const onCustom = (event: Event) => {
    const detail = (event as CustomEvent<number>).detail;
    listener(clampContentZoom(detail));
  };
  window.addEventListener(CONTENT_ZOOM_EVENT, onCustom);
  return () => window.removeEventListener(CONTENT_ZOOM_EVENT, onCustom);
}
