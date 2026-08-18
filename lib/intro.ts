/**
 * Shared boot-intro gate.
 *
 * Three places need the same answer to "will the intro play on this load?":
 *   - the pre-paint inline script (components/intro-preflight.tsx), which
 *     covers the app before first paint so the shell never flashes,
 *   - the login-screen preloader (components/intro-preload.tsx), which warms
 *     the media cache so playback starts instantly,
 *   - the component itself (components/intro-moment.tsx), which also
 *     waits until the document is visible so a hidden desktop window
 *     cannot burn the day's play, and re-checks when the window comes
 *     forward (tray restore on a new calendar day).
 * Keep them in sync by going through here.
 */

/** Storage key for the last calendar day the film actually started. `.v2` so a
 *  hidden desktop launch that marked the old key without showing the film
 *  does not skip the first real play after this fix. */
export const INTRO_DAY_KEY = "tempo.introDay.v2";

/**
 * Set for one session when ORIGIN hands off into the app, so the artist doesn't
 * get the boot intro immediately after the onboarding film — two introductions
 * back to back. Session-scoped: the intro returns to normal on the next visit.
 */
export const SUPPRESS_INTRO_KEY = "tempo.suppressBootIntro";

/** Set just before ORIGIN navigates into the authenticated app. */
export const ORIGIN_ARRIVAL_KEY = "tempo.originFirstOpen";

/** Set on <html> before first paint while the intro is still expected. */
export const INTRO_PENDING_ATTR = "data-intro-pending";

/** Current boot film. Filename is versioned because `/intro/*` is cached as
 *  immutable for a year — swapping the file in place left desktop playing the
 *  earlier film. One H.264 MP4; the previous WebM source is gone. */
export const INTRO_SOURCES: { src: string; type: string }[] = [
  { src: "/intro/tempo-intro-v2.mp4", type: "video/mp4" },
];

export const INTRO_POSTER = "/intro/tempo-intro-v2-poster.jpg";

/** Local calendar day, so "once a day" follows the user's clock, not UTC. */
export function introDayKey(d: Date = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/**
 * Whether the intro should play on this load. Safe to call before mount —
 * only touches window/localStorage behind guards.
 *
 * Does not consume the day — the overlay waits until the document is actually
 * visible (TEMPO Desktop starts hidden, and lives in the tray) and only then
 * marks the day once playback starts.
 */
export function introWillPlay(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return false;
    }
  } catch {
    /* matchMedia unavailable */
  }
  try {
    if (sessionStorage.getItem(SUPPRESS_INTRO_KEY) === "1") return false;
  } catch {
    /* private mode */
  }
  try {
    return localStorage.getItem(INTRO_DAY_KEY) !== introDayKey();
  } catch {
    // Private mode: no way to remember, so don't gate on it.
    return true;
  }
}

export function markIntroPlayed(d: Date = new Date()) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(INTRO_DAY_KEY, introDayKey(d));
  } catch {
    /* private mode */
  }
}

export function introDocumentIsHidden() {
  if (typeof document === "undefined") return false;
  try {
    return document.visibilityState === "hidden";
  } catch {
    return false;
  }
}

export function setIntroPending() {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(INTRO_PENDING_ATTR, "");
}

export function clearIntroPending() {
  if (typeof document === "undefined") return;
  document.documentElement.removeAttribute(INTRO_PENDING_ATTR);
}
