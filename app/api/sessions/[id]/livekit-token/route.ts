/**
 * POST /api/sessions/[id]/livekit-token
 * Member LiveKit JWT. Membership is checked via RPC on the RLS client.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  isLiveKitConfigured,
  LIVEKIT_UNAVAILABLE_MESSAGE,
  mintSessionLiveKitToken,
} from "@/lib/sessions/livekit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function profileName(raw: unknown): string {
  const value = (Array.isArray(raw) ? raw[0] : raw) as { display_name?: string } | null;
  return value?.display_name?.trim() || "Member";
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isLiveKitConfigured()) {
    return NextResponse.json(
      { error: LIVEKIT_UNAVAILABLE_MESSAGE },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const { data: member, error } = await supabase.rpc("is_session_member", { p_room_id: params.id });
  if (error || !member) {
    return NextResponse.json({ error: "Session unavailable" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const [{ data: room }, { data: memberRow }, { data: meet }] = await Promise.all([
    supabase.from("session_rooms").select("title").eq("id", params.id).maybeSingle(),
    supabase
      .from("session_members")
      .select("profile:artist_profiles(display_name)")
      .eq("session_room_id", params.id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle(),
    supabase.from("session_meets").select("id").eq("session_room_id", params.id).is("ended_at", null).maybeSingle(),
  ]);
  const displayName = profileName(memberRow?.profile);
  if (meet?.id) {
    await supabase.rpc("upsert_session_attendance", {
      p_meet_id: meet.id,
      p_display_name: displayName,
    });
  }

  const minted = await mintSessionLiveKitToken({
    sessionRoomId: params.id,
    kind: "member",
    id: user.id,
    displayName,
    canPublish: true,
    ttlSeconds: 4 * 60 * 60,
    metadata: { title: room?.title ?? "Session" },
  });
  return NextResponse.json(minted, { headers: { "Cache-Control": "no-store" } });
}
