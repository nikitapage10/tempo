import { NextResponse } from "next/server";
import { DESKTOP_MAC_INSTALLER_URL } from "@/lib/desktop/handoff";
import { fetchLatestDesktopAssets } from "@/lib/desktop/public-channel";
import { publicInstallerExists } from "@/lib/desktop/installer-probe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Stable Mac download entry — same latest-tracking as Windows.
 */
export async function GET() {
  const override = process.env.NEXT_PUBLIC_DESKTOP_MAC_URL;
  const latest = override ? null : await fetchLatestDesktopAssets();
  const candidates = [
    override,
    latest?.macUrl,
    DESKTOP_MAC_INSTALLER_URL,
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

  return NextResponse.json(
    { error: "The Mac build isn’t on the public download channel yet." },
    { status: 404, headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
