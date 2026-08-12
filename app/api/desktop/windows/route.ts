import { NextResponse } from "next/server";
import {
  DESKTOP_PUBLIC_CHANNEL_INSTALLER_URL,
  DESKTOP_WINDOWS_BUNDLED_FALLBACK_URL,
} from "@/lib/desktop/handoff";
import { publicInstallerExists } from "@/lib/desktop/installer-probe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Stable download URL for Windows. Prefers the version-pinned public release
 * so Download always gets the fixed installer; falls back to the bundled beta
 * under /downloads when that channel asset is missing.
 */
export async function GET(request: Request) {
  const preferred =
    process.env.NEXT_PUBLIC_DESKTOP_WINDOWS_URL || DESKTOP_PUBLIC_CHANNEL_INSTALLER_URL;
  const target = (await publicInstallerExists(preferred))
    ? preferred
    : new URL(DESKTOP_WINDOWS_BUNDLED_FALLBACK_URL, request.url).toString();

  const response = NextResponse.redirect(target, 302);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
