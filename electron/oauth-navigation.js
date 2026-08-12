/**
 * Which navigations stay inside TEMPO Desktop vs open in the system browser.
 *
 * Google / Microsoft sign-in must NOT run inside Electron's embedded Chromium —
 * providers flag it as an insecure app. OAuth opens in the system browser and
 * returns via tempo://auth/callback (see oauth-buttons + auth/desktop-bridge).
 * Only the TEMPO web origin stays in-app.
 */

/**
 * @param {string} urlString
 * @param {string[]} allowedOrigins TEMPO web origins (e.g. production Vercel)
 * @returns {boolean}
 */
function isAllowedDesktopNavigation(urlString, allowedOrigins) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    return false;
  }

  return allowedOrigins.includes(url.origin);
}

/**
 * Normalize Windows / macOS quirks for tempo:// deep links.
 * @param {URL} link
 */
function isAuthCallbackLink(link) {
  const host = (link.hostname || "").toLowerCase();
  const path = (link.pathname || "").replace(/\/+$/, "") || "";
  const pathNorm = path.replace(/^\/+/, "/");

  // tempo://auth/callback?code=…
  if (host === "auth" && (pathNorm === "/callback" || pathNorm === "" || pathNorm === "/")) {
    return true;
  }
  // tempo:///auth/callback?code=… (empty host, path carries auth/callback)
  if (
    !host &&
    (pathNorm === "/auth/callback" ||
      pathNorm === "//auth/callback" ||
      pathNorm === "/callback")
  ) {
    return true;
  }
  // tempo://callback?code=…
  if (host === "callback" && (pathNorm === "" || pathNorm === "/")) {
    return true;
  }
  return false;
}

/**
 * Resolve a tempo:// deep link to an https URL loaded inside the main window.
 * Supports:
 *   tempo://open?path=/tracks
 *   tempo://auth/callback?code=…&next=/
 *
 * @param {string | null | undefined} rawUrl
 * @param {string} appUrl production TEMPO origin (no trailing path)
 * @param {string[]} allowedOrigins
 * @returns {string | null}
 */
function appLinkDestination(rawUrl, appUrl, allowedOrigins) {
  if (!rawUrl) return null;
  try {
    const link = new URL(rawUrl);
    if (link.protocol !== "tempo:") return null;

    if (isAuthCallbackLink(link)) {
      const code = link.searchParams.get("code");
      if (!code) return null;
      const nextRaw = link.searchParams.get("next") || "/";
      const next =
        nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";
      const destination = new URL("/auth/callback", appUrl);
      destination.searchParams.set("code", code);
      destination.searchParams.set("next", next);
      for (const key of ["state", "error", "error_description"]) {
        const value = link.searchParams.get(key);
        if (value) destination.searchParams.set(key, value);
      }
      return allowedOrigins.includes(destination.origin)
        ? destination.href
        : null;
    }

    if (link.hostname !== "open") return null;
    const requestedPath = link.searchParams.get("path") || "/";
    if (!requestedPath.startsWith("/") || requestedPath.startsWith("//")) {
      return null;
    }
    const destination = new URL(requestedPath, appUrl);
    return allowedOrigins.includes(destination.origin)
      ? destination.href
      : null;
  } catch {
    return null;
  }
}

module.exports = { isAllowedDesktopNavigation, appLinkDestination, isAuthCallbackLink };
