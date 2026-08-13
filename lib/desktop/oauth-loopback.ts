/**
 * Local handoff after Google / Microsoft sign-in on TEMPO Desktop.
 *
 * The system browser lands on /auth/desktop-bridge (already on the Supabase
 * redirect allow-list). Chrome/Edge often refuse to follow tempo:// without a
 * click, so the landing page also posts the one-time code to this loopback
 * server inside the desktop shell. PKCE still lives in Electron.
 *
 * Keep these values in lockstep with electron/oauth-loopback.js.
 */
export const OAUTH_LOOPBACK_HOST = "127.0.0.1";
export const OAUTH_LOOPBACK_PATH = "/oauth/handoff";
export const OAUTH_LOOPBACK_PORTS = [47821, 47822, 47823, 47824, 47825] as const;
