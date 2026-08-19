import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const DAILY_AUDIO_SECONDS = 4 * 60 * 60;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers });
  const input = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const instanceId = typeof input.instanceId === "string" ? input.instanceId : "";
  const body = typeof input.body === "string" ? input.body.trim().slice(0, 4000) : "";
  const speakerLabel = typeof input.speakerLabel === "string" ? input.speakerLabel.trim().slice(0, 100) : "";
  const audioSeconds = typeof input.audioSeconds === "number" ? Math.max(0, Math.min(30, Math.ceil(input.audioSeconds))) : 0;
  if (!instanceId || !body) return NextResponse.json({ error: "There are no new notes to save." }, { status: 400, headers });

  const admin = createAdminClient();
  const [{ data: member }, { data: meet }] = await Promise.all([
    admin.from("session_members").select("user_id").eq("session_room_id", params.id).eq("user_id", user.id).eq("status", "active").maybeSingle(),
    admin.from("session_meets").select("id, notes_enabled").eq("id", instanceId).eq("session_room_id", params.id).is("ended_at", null).maybeSingle(),
  ]);
  if (!member || !meet || !meet.notes_enabled) return NextResponse.json({ error: "Note taking is off." }, { status: 403, headers });

  const today = new Date().toISOString().slice(0, 10);
  const { data: usage } = await admin.from("assistant_usage").select("audio_seconds").eq("user_id", user.id).eq("day", today).maybeSingle();
  const used = Number(usage?.audio_seconds ?? 0);
  if (used + audioSeconds > DAILY_AUDIO_SECONDS) {
    return NextResponse.json({ error: "Daily note taking time is used up. The session can keep going without it.", quota: true }, { status: 429, headers });
  }
  await admin.from("assistant_usage").upsert({
    user_id: user.id,
    day: today,
    audio_seconds: used + audioSeconds,
  }, { onConflict: "user_id,day" });
  const { error } = await admin.from("session_transcript_lines").insert({
    session_meet_id: instanceId,
    speaker_user_id: user.id,
    speaker_label: speakerLabel || "Member",
    body,
  });
  if (error) return NextResponse.json({ error: "Couldn’t save those notes." }, { status: 500, headers });
  return NextResponse.json({ ok: true }, { headers });
}
