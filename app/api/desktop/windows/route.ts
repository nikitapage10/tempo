import { NextResponse } from "next/server";
import {
  DESKTOP_PUBLIC_CHANNEL_INSTALLER_URL,
  DESKTOP_WINDOWS_BUNDLED_FALLBACK_URL,
} from "@/lib/desktop/handoff";
import { publicInstallerExists } from "@/lib/desktop/installer-probe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Stable download URL for Windows. Prefers the public release channel so the
 * Download button always tracks Desktop Release; falls back to the bundled
 * beta under /downloads when that channel is empty.
 */
export async function GET(request: Request) {
  const preferred =
    process.env.NEXT_PUBLIC_DESKTOP_WINDOWS_URL || DESKTOP_PUBLIC_CHANNEL_INSTALLER_URL;
  if (await publicInstallerExists(preferred)) {
    return NextResponse.redirect(preferred, 302);
  }
  return NextResponse.redirect(new URL(DESKTOP_WINDOWS_BUNDLED_FALLBACK_URL, request.url), 302);
}
