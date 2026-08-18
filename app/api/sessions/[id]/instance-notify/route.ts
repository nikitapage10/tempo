import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = (await req.json().catch(() => null)) as { instanceId?: unknown } | null;
  if (!body || typeof body.instanceId !== "string") {
    return NextResponse.json({ error: "Invalid session instance." }, { status: 400, headers });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401, headers });
  }

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("session_members")
    .select("profile_id, profile:artist_profiles(display_name)")
    .eq("session_room_id", params.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "Session unavailable." }, { status: 403, headers });
  }

  const [{ data: instance }, { data: room }, { data: recipients }, { data: conversation }] =
    await Promise.all([
      admin
        .from("session_meets")
        .select("id")
        .eq("id", body.instanceId)
        .eq("session_room_id", params.id)
        .is("ended_at", null)
        .maybeSingle(),
      admin
        .from("session_rooms")
        .select("title, track:tracks(title)")
        .eq("id", params.id)
        .maybeSingle(),
      admin
        .from("session_members")
        .select("user_id")
        .eq("session_room_id", params.id)
        .eq("status", "active")
        .neq("user_id", user.id),
      admin.from("conversations").select("id").eq("session_room_id", params.id).maybeSingle(),
    ]);

  if (!instance || !room) {
    return NextResponse.json({ error: "Session instance unavailable." }, { status: 404, headers });
  }

  const profile = Array.isArray(member.profile) ? member.profile[0] : member.profile;
  const starter = (profile as { display_name?: string } | null)?.display_name?.trim() || "A member";
  const track = Array.isArray(room.track) ? room.track[0] : room.track;
  const subject = (track as { title?: string } | null)?.title?.trim() || room.title;
  const notificationRows = (recipients ?? []).map((recipient) => ({
    user_id: recipient.user_id,
    type: "session_live",
    title: `${subject} is live`,
    body: `${starter} started a session`,
    entity_type: "session_room",
    entity_id: params.id,
    link_url: `/sessions/${params.id}`,
  }));

  if (notificationRows.length) {
    const { error } = await admin.from("notifications").insert(notificationRows);
    if (error) {
      return NextResponse.json({ error: "Couldn’t notify the room." }, { status: 500, headers });
    }
  }

  if (conversation?.id) {
    await admin.from("messages").insert({
      conversation_id: conversation.id,
      sender_user_id: user.id,
      sender_profile_id: member.profile_id,
      body: `::system::${starter} started the session`,
    });
  }

  return NextResponse.json({ ok: true, notified: notificationRows.length }, { headers });
}
