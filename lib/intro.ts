/**
 * Shared boot-intro gate.
 *
 * Three places need the same answer to "will the intro play on this load?":
 *   - the pre-paint inline script (components/intro-preflight.tsx), which
 *     covers the app before first paint so the shell never flashes,
 *   - the login-screen preloader (components/intro-preload.tsx), which warms
 *     the media cache so playback starts instantly,
 *   - the component itself (components/intro-moment.tsx).
 * Keep them in sync by going through here.
 */

export const INTRO_DAY_KEY = "tempo.introDay";

/**
 * Set for one session when ORIGIN hands off into the app, so the artist doesn't
 * get the boot intro immediately after the onboarding film — two introductions
 * back to back. Session-scoped: the intro returns to normal on the next visit.
 */
export const SUPPRESS_INTRO_KEY = "tempo.suppressBootIntro";

/** Set on <html> before first paint while the intro is still expected. */
export const INTRO_PENDING_ATTR = "data-intro-pending";

/** webm first — ~1/3 the size of the mp4 where it's supported. */
export const INTRO_SOURCES: { src: string; type: string }[] = [
  { src: "/intro/tempo-intro.webm", type: "video/webm" },
  { src: "/intro/tempo-intro.mp4", type: "video/mp4" },
];

export const INTRO_POSTER = "/intro/tempo-intro-poster.jpg";

/** Local calendar day, so "once a day" follows the user's clock, not UTC. */
export function introDayKey(d: Date = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/**
 * Whether the intro should play on this load. Safe to call before mount —
 * only touches window/localStorage behind guards.
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

export function clearIntroPending() {
  if (typeof document === "undefined") return;
  document.documentElement.removeAttribute(INTRO_PENDING_ATTR);
}
