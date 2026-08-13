import { NextResponse } from "next/server";
import {
  DESKTOP_PUBLIC_CHANNEL_INSTALLER_URL,
  DESKTOP_WINDOWS_BUNDLED_FALLBACK_URL,
} from "@/lib/desktop/handoff";
import { fetchLatestDesktopAssets } from "@/lib/desktop/public-channel";
import { publicInstallerExists } from "@/lib/desktop/installer-probe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Stable Windows download entry. Prefers whatever GitHub currently marks as
 * latest on the public channel (so a Desktop Release flips Download without a
 * web redeploy), then the pinned shell URL, then the bundled beta.
 */
export async function GET(request: Request) {
  const override = process.env.NEXT_PUBLIC_DESKTOP_WINDOWS_URL;
  const latest = override ? null : await fetchLatestDesktopAssets();
  const candidates = [
    override,
    latest?.windowsUrl,
    DESKTOP_PUBLIC_CHANNEL_INSTALLER_URL,
  ].filter((url): url is string => Boolean(url));

  for (const candidate of candidates) {
    if (await publicInstallerExists(candidate)) {
      const response = NextResponse.redirect(candidate, 302);
      response.headers.set("Cache-Control", "no-store, max-age=0");
      if (latest?.version) {
        response.headers.set("X-TEMPO-Desktop-Version", latest.version);
      }
      return response;
    }
  }

  const response = NextResponse.redirect(
    new URL(DESKTOP_WINDOWS_BUNDLED_FALLBACK_URL, request.url),
    302
  );
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
