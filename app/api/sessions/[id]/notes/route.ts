import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers });
  const body = (await req.json().catch(() => ({}))) as { instanceId?: unknown; enabled?: unknown };
  if (typeof body.instanceId !== "string" || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "Note taking request is incomplete." }, { status: 400, headers });
  }
  const admin = createAdminClient();
  const [{ data: member }, { data: meet }] = await Promise.all([
    admin.from("session_members").select("profile_id, profile:artist_profiles(display_name)").eq("session_room_id", params.id).eq("user_id", user.id).eq("status", "active").maybeSingle(),
    admin.from("session_meets").select("id").eq("id", body.instanceId).eq("session_room_id", params.id).is("ended_at", null).maybeSingle(),
  ]);
  if (!member || !meet) return NextResponse.json({ error: "Session unavailable." }, { status: 403, headers });
  const { error } = await admin.from("session_meets").update({ notes_enabled: body.enabled }).eq("id", body.instanceId);
  if (error) return NextResponse.json({ error: "Couldn’t change note taking." }, { status: 500, headers });
  const { data: conversation } = await admin.from("conversations").select("id").eq("session_room_id", params.id).maybeSingle();
  const profile = Array.isArray(member.profile) ? member.profile[0] : member.profile;
  const name = (profile as { display_name?: string } | null)?.display_name?.trim() || "Someone";
  if (conversation?.id) {
    await admin.from("messages").insert({
      conversation_id: conversation.id,
      sender_user_id: user.id,
      sender_profile_id: member.profile_id,
      body: `::system::${name} turned note taking ${body.enabled ? "on" : "off"}`,
    });
  }
  return NextResponse.json({ enabled: body.enabled }, { headers });
}
