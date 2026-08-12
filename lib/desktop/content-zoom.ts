/**
 * Desktop content zoom — scales the main workspace, not the left rail.
 * Native Electron page zoom (setZoomFactor) is forced to 1.0 so the rail
 * and window chrome stay a stable click size while Today / Tracks / etc.
 * can still grow or shrink.
 */

export const CONTENT_ZOOM_MIN = 0.5;
export const CONTENT_ZOOM_MAX = 2.0;
export const CONTENT_ZOOM_STEP = 0.1;
export const CONTENT_ZOOM_STORAGE_KEY = "tempo.contentZoom";
export const CONTENT_ZOOM_EVENT = "tempo:content-zoom";

export function clampContentZoom(value: number): number {
  if (!Number.isFinite(value)) return 1;
  const stepped = Math.round(value * 10) / 10;
  return Math.min(CONTENT_ZOOM_MAX, Math.max(CONTENT_ZOOM_MIN, stepped));
}

export function readContentZoom(): number {
  if (typeof window === "undefined") return 1;
  try {
    const raw = window.localStorage.getItem(CONTENT_ZOOM_STORAGE_KEY);
    if (raw == null || raw === "") return 1;
    return clampContentZoom(Number(raw));
  } catch {
    return 1;
  }
}

export function writeContentZoom(factor: number): number {
  const next = clampContentZoom(factor);
  if (typeof window === "undefined") return next;
  try {
    window.localStorage.setItem(CONTENT_ZOOM_STORAGE_KEY, String(next));
  } catch {
    /* ignore quota */
  }
  window.dispatchEvent(
    new CustomEvent<number>(CONTENT_ZOOM_EVENT, { detail: next })
  );
  return next;
}

/** delta 0 resets to 100%. */
export function nudgeContentZoom(delta: number): number {
  if (delta === 0) return writeContentZoom(1);
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
