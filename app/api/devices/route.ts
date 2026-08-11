import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PLATFORMS = new Set(["windows", "mac"]);

/**
 * GET /api/devices — the signed-in user's registered desktop installs.
 * Drives the web app's "Open in desktop" button state (a recent row exists)
 * vs. "Download for …" (it doesn't) — see planning/desktop/02 §4.
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_devices")
    .select("id, platform, name, app_version, sync_enabled, last_seen_at")
    .eq("user_id", user.id)
    .order("last_seen_at", { ascending: false });

  if (error) {
    console.error("[devices][GET]", error);
    return NextResponse.json({ error: "Couldn’t load your devices." }, { status: 500 });
  }

  return NextResponse.json({ devices: data ?? [] });
}

/**
 * POST /api/devices — called by the desktop app on sign-in and on each
 * background sync tick to register itself / refresh last_seen_at.
 * Body: { deviceId?, platform, name, appVersion, syncEnabled? }
 * deviceId omitted on first call; the desktop app persists the id it gets back.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const platform = typeof body?.platform === "string" ? body.platform : "";
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  const appVersion = typeof body?.appVersion === "string" ? body.appVersion.trim() : "";
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId : null;
  const syncEnabled = typeof body?.syncEnabled === "boolean" ? body.syncEnabled : true;

  if (!PLATFORMS.has(platform) || !name || !appVersion) {
    return NextResponse.json(
      { error: "platform, name, and appVersion are required." },
      { status: 400 },
    );
  }

  const row = {
    user_id: user.id,
    platform,
    name,
    app_version: appVersion,
    sync_enabled: syncEnabled,
    last_seen_at: new Date().toISOString(),
  };

  const query = deviceId
    ? supabase
        .from("user_devices")
        .update(row)
        .eq("id", deviceId)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle()
    : supabase.from("user_devices").insert(row).select("id").single();

  const { data, error } = await query;
  if (error || !data) {
    console.error("[devices][POST]", error);
    return NextResponse.json({ error: "Couldn’t register this device." }, { status: 500 });
  }

  return NextResponse.json({ deviceId: data.id });
}
