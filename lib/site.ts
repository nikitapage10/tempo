/** Canonical production origin — never ship localhost in auth/PWA redirects. */
export const PRODUCTION_SITE_URL = "https://mytempo.dev";

/**
 * Base URL for absolute links (auth callbacks, etc.).
 * Localhost keeps local origin for dev; everything else uses production.
 */
export function getSiteUrl(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return window.location.origin;
    }
  }
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || PRODUCTION_SITE_URL
  );
}

export function getAuthCallbackUrl(): string {
  return `${getSiteUrl()}/auth/callback`;
}
