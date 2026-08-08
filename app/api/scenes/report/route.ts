import { type NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const headers: HeadersInit = { "Cache-Control": "no-store" };
const reasons = new Set(["spam", "harassment", "hate", "impersonation", "inappropriate", "other"]);
const targetTypes = new Set(["scene_post", "scene_comment", "scene"]);

/**
 * A member's report of scene content — separate from app/api/social/report,
 * since scenes carry a scene_id and their own target-type set. Modeled on
 * that route: same auth gate, same hand-validated shape, same never-leak-a-
 * raw-db-error posture.
 */
export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers });

  const body = await request.json().catch(() => null);
  const reporterProfileId = typeof body?.reporterProfileId === "string" ? body.reporterProfileId : "";
  const sceneId = typeof body?.sceneId === "string" ? body.sceneId : "";
  const targetType = typeof body?.targetType === "string" && targetTypes.has(body.targetType) ? body.targetType : "";
  const targetId = typeof body?.targetId === "string" ? body.targetId : "";
  const reason = typeof body?.reason === "string" ? body.reason : "";
  const details =
    typeof body?.details === "string" && body.details.trim()
      ? body.details.trim().slice(0, 2000)
      : null;

  if (!reporterProfileId || !sceneId || !targetType || !targetId || !reasons.has(reason)) {
    return NextResponse.json({ error: "Choose a reason for the report." }, { status: 400, headers });
  }

  const id = crypto.randomUUID();
  const { error } = await supabase.from("content_reports").insert({
    id,
    reporter_profile_id: reporterProfileId,
    target_type: targetType,
    target_id: targetId,
    reason,
    details,
    scene_id: sceneId,
  });
  if (error) {
    return NextResponse.json(
      { error: "Couldn’t send this report. You can’t report your own content." },
      { status: 400, headers }
    );
  }
  return NextResponse.json({ ok: true, id }, { status: 201, headers });
}
