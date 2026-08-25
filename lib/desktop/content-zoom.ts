/**
 * Desktop content zoom — scales the main workspace, not the left rail's
 * hit-target chrome. Native Electron page zoom (setZoomFactor) is forced to
 * 1.0 so window chrome stays stable.
 *
 * The rail remains at its designed size at every zoom. Large-screen baseline
 * sizing belongs to responsive CSS, so 100% means 100% on every display.
 */

export const CONTENT_ZOOM_MIN = 0.5;
export const CONTENT_ZOOM_MAX = 2.0;
export const CONTENT_ZOOM_STEP = 0.1;
export const RAIL_LABELED_WIDTH_PX = 220;
export const RAIL_COMPACT_WIDTH_PX = 68;
export const CONTENT_ZOOM_STORAGE_KEY = "tempo.contentZoom";
export const CONTENT_ZOOM_EVENT = "tempo:content-zoom";
/** Bumped when display-generated zoom changes so old defaults can migrate. */
export const CONTENT_ZOOM_DEFAULT_GEN = 4;
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
  _metrics: DisplayMetrics = readDisplayMetrics()
): number {
  // Responsive CSS now supplies the larger physical baseline. Keep the
  // control honest: reset and first run both mean exactly 100%.
  return 1;
}

export function defaultContentZoom(): number {
  return clampContentZoom(suggestedContentZoom());
}

/** The zoom control affects the workspace, never the navigation rail. */
export function railTypeZoom(
  _contentZoom: number,
  _labeledRail: boolean
): number {
  return 1;
}

export function railLayoutWidthPx(
  _contentZoom: number,
  labeledRail: boolean
): number {
  if (!labeledRail) return RAIL_COMPACT_WIDTH_PX;
  return RAIL_LABELED_WIDTH_PX;
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
      // v0.212.0 generated 140% on 3440×1440. Move that implicit default back
      // to 100%, while preserving every other explicit zoom choice.
      const generatedUltrawideDefault = gen === 3 && stored === 1.4;
      if (
        gen >= CONTENT_ZOOM_DEFAULT_GEN ||
        (stored !== 1 && !generatedUltrawideDefault)
      ) {
        return stored;
      }
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
