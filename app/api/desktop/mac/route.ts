import { NextResponse } from "next/server";
import { DESKTOP_MAC_INSTALLER_URL } from "@/lib/desktop/handoff";
import { publicInstallerExists } from "@/lib/desktop/installer-probe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Stable download URL for Mac. Points at the public unsigned DMG once Desktop
 * Release has published it; 404s until then so we never invent a fake file.
 */
export async function GET() {
  const preferred = process.env.NEXT_PUBLIC_DESKTOP_MAC_URL || DESKTOP_MAC_INSTALLER_URL;
  if (await publicInstallerExists(preferred)) {
    return NextResponse.redirect(preferred, 302);
  }
  return NextResponse.json(
    { error: "The Mac build isn’t on the public download channel yet." },
    { status: 404 }
  );
}
