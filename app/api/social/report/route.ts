import { type NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const headers: HeadersInit = { "Cache-Control": "no-store" };
const reasons = new Set(["spam", "harassment", "hate", "impersonation", "inappropriate", "other"]);

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers });
  const body = await request.json().catch(() => null);
  const reporterProfileId = typeof body?.reporterProfileId === "string" ? body.reporterProfileId : "";
  const targetType = body?.targetType === "post" || body?.targetType === "profile" ? body.targetType : "";
  const targetId = typeof body?.targetId === "string" ? body.targetId : "";
  const reason = typeof body?.reason === "string" ? body.reason : "";
  const details = typeof body?.details === "string" && body.details.trim() ? body.details.trim().slice(0, 2000) : null;
  if (!reporterProfileId || !targetType || !targetId || !reasons.has(reason)) return NextResponse.json({ error: "Choose a reason for the report." }, { status: 400, headers });
  const id = crypto.randomUUID();
  const { error } = await supabase.from("content_reports").insert({ id, reporter_profile_id: reporterProfileId, target_type: targetType, target_id: targetId, reason, details });
  if (error) return NextResponse.json({ error: "Couldn’t send this report. You can’t report your own content." }, { status: 400, headers });
  return NextResponse.json({ ok: true, id }, { status: 201, headers });
}
