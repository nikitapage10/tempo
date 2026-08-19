import { NextResponse, type NextRequest } from "next/server";
import { ASSISTANT_MODEL, createOpenAIClient, friendlyAIError, isOpenAIConfigured } from "@/lib/ai/openai";
import { cleanSessionRecap, SESSION_RECAP_SCHEMA, type SessionRecap } from "@/lib/sessions/recap-schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
const headers = { "Cache-Control": "no-store" };
const MAX_TRANSCRIPT_CHARS = 48_000;
const DAILY_AUDIO_SECONDS = 4 * 60 * 60;

function outputText(response: { output_text?: string; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> }): string {
  if (response.output_text?.trim()) return response.output_text;
  return (response.output ?? []).flatMap((item) => item.type === "message" ? item.content ?? [] : []).filter((block) => block.type === "output_text").map((block) => block.text ?? "").join("");
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isOpenAIConfigured()) return NextResponse.json({ error: "Recap suggestions are not available right now." }, { status: 503, headers });
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers });
  const input = (await req.json().catch(() => ({}))) as { instanceId?: unknown };
  if (typeof input.instanceId !== "string") return NextResponse.json({ error: "Choose a session to recap." }, { status: 400, headers });
  const admin = createAdminClient();
  const [{ data: member }, { data: meet }, { data: members }, { data: agenda }, { data: lines }, { data: usage }] = await Promise.all([
    admin.from("session_members").select("user_id").eq("session_room_id", params.id).eq("user_id", user.id).eq("status", "active").maybeSingle(),
    admin.from("session_meets").select("id").eq("id", input.instanceId).eq("session_room_id", params.id).maybeSingle(),
    admin.from("session_members").select("profile:artist_profiles(display_name)").eq("session_room_id", params.id).eq("status", "active"),
    admin.from("session_agenda_items").select("body").eq("session_room_id", params.id).order("sort"),
    admin.from("session_transcript_lines").select("speaker_label, body, said_at").eq("session_meet_id", input.instanceId).order("said_at"),
    admin.from("assistant_usage").select("audio_seconds").eq("user_id", user.id).eq("day", new Date().toISOString().slice(0, 10)).maybeSingle(),
  ]);
  if (!member || !meet) return NextResponse.json({ error: "Session unavailable." }, { status: 403, headers });
  if (Number(usage?.audio_seconds ?? 0) > DAILY_AUDIO_SECONDS) return NextResponse.json({ error: "Daily recap time is used up. Add a summary by hand instead." }, { status: 429, headers });
  if (!lines?.length) return NextResponse.json({ error: "There is not enough note taking text for a recap yet." }, { status: 422, headers });
  const names = (members ?? []).map((row) => {
    const profile = row.profile as unknown as { display_name?: string | null } | Array<{ display_name?: string | null }> | null;
    return Array.isArray(profile) ? profile[0]?.display_name : profile?.display_name;
  }).filter((name): name is string => Boolean(name));
  const agendaBodies = (agenda ?? []).map((item) => item.body as string);
  const transcript = lines.map((line) => `${line.speaker_label}: ${line.body}`).join("\n").slice(-MAX_TRANSCRIPT_CHARS);
  try {
    const response = await createOpenAIClient().responses.create({
      model: ASSISTANT_MODEL,
      store: false,
      reasoning: { effort: "none" },
      instructions:
        "Create editable recap proposals from a music work session transcript. Use plain English. " +
        `Real member names: ${names.length ? names.join(", ") : "none supplied"}. ` +
        `Real agenda items: ${agendaBodies.length ? agendaBodies.join(" | ") : "none supplied"}. ` +
        "Only use an assignee name or agenda item exactly as supplied. Never invent a person, owner, due date, decision, or task. " +
        "Leave uncertain owners and dates null. Return no more than eight decisions and eight tasks.",
      input: transcript,
      text: { format: { type: "json_schema", name: "session_recap", schema: SESSION_RECAP_SCHEMA, strict: true } },
    });
    const recap = cleanSessionRecap(JSON.parse(outputText(response)) as SessionRecap);
    return NextResponse.json(recap, { headers });
  } catch (error) {
    return NextResponse.json({ error: friendlyAIError(error) }, { status: 502, headers });
  }
}
