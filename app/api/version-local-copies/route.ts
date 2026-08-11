import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/version-local-copies?versionIds=a,b,c — which of these versions
 * have a confirmed local copy on some device, and on which. Drives the
 * "on another computer" badge and the retention-eviction safety check
 * (see lib/version-prune.ts and planning/desktop/02 §4-5). RLS
 * (migrations/081_desktop_vault_and_retention.sql) already scopes rows to
 * what the signed-in user can read, so this is a thin pass-through.
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const raw = req.nextUrl.searchParams.get("versionIds") ?? "";
  const versionIds = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (versionIds.length === 0) {
    return NextResponse.json({ copies: [] });
  }

  const { data, error } = await supabase
    .from("version_local_copies")
    .select("version_id, device_id, checksum, confirmed_at")
    .in("version_id", versionIds);

  if (error) {
    console.error("[version-local-copies][GET]", error);
    return NextResponse.json({ error: "Couldn’t load local copy records." }, { status: 500 });
  }

  return NextResponse.json({ copies: data ?? [] });
}

/**
 * POST /api/version-local-copies — the desktop app confirms it has mirrored
 * a bounce. Body: { versionId, deviceId, checksum }.
 * Upserts on (version_id, device_id) — re-confirming an existing copy (e.g.
 * after a checksum-mismatch re-mirror) just refreshes it.
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
  const versionId = typeof body?.versionId === "string" ? body.versionId : "";
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId : "";
  const checksum = typeof body?.checksum === "string" ? body.checksum : "";

  if (!versionId || !deviceId || !checksum) {
    return NextResponse.json(
      { error: "versionId, deviceId, and checksum are required." },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("version_local_copies").upsert(
    {
      version_id: versionId,
      device_id: deviceId,
      checksum,
      confirmed_at: new Date().toISOString(),
    },
    { onConflict: "version_id,device_id" },
  );

  if (error) {
    console.error("[version-local-copies][POST]", error);
    return NextResponse.json({ error: "Couldn’t confirm this local copy." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
