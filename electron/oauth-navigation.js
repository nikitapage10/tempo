/**
 * Which navigations stay inside TEMPO Desktop vs open in the system browser.
 * OAuth (Google / Microsoft) must complete inside Electron so the session
 * cookies land in the app — not in an external browser tab.
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

  if (allowedOrigins.includes(url.origin)) return true;

  const host = url.hostname.toLowerCase();

  // Supabase Auth hosts the provider handoff before returning to TEMPO.
  if (host === "supabase.co" || host.endsWith(".supabase.co")) return true;

  // Google Identity
  if (
    host === "accounts.google.com" ||
    host === "account.google.com" ||
    host.endsWith(".google.com") ||
    host.endsWith(".googleusercontent.com") ||
    host.endsWith(".gstatic.com")
  ) {
    return true;
  }

  // Microsoft / Entra ID
  if (
    host.endsWith(".microsoftonline.com") ||
    host.endsWith(".microsoftonline-p.com") ||
    host.endsWith(".microsoft.com") ||
    host.endsWith(".live.com") ||
    host.endsWith(".msn.com") ||
    host.endsWith(".msauth.net") ||
    host.endsWith(".msftauth.net") ||
    host.endsWith(".microsoftauth.net") ||
    host.endsWith(".windows.net") ||
    host.endsWith(".office.com") ||
    host === "aka.ms"
  ) {
    return true;
  }

  return false;
}

module.exports = { isAllowedDesktopNavigation };
