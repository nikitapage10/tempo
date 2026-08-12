import { NextResponse } from "next/server";
import { DESKTOP_SHELL_VERSION } from "@/lib/desktop/handoff";
import { fetchLatestDesktopAssets } from "@/lib/desktop/public-channel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Lightweight version probe for the Download page label — always mirrors the
 * public channel's current latest tag when available.
 */
export async function GET() {
  const latest = await fetchLatestDesktopAssets();
  return NextResponse.json(
    {
      version: latest?.version ?? DESKTOP_SHELL_VERSION,
      source: latest?.version ? "public-channel" : "bundled-pin",
      windows: Boolean(latest?.windowsUrl),
      mac: Boolean(latest?.macUrl),
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
