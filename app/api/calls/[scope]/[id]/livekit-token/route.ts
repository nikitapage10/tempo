import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/guard";
import {
  isLiveKitConfigured,
  LIVEKIT_UNAVAILABLE_MESSAGE,
  mintCallToken,
} from "@/lib/sessions/livekit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };

export async function POST(_req: NextRequest, { params }: { params: { scope: string; id: string } }) {
  if (!isLiveKitConfigured()) return NextResponse.json({ error: LIVEKIT_UNAVAILABLE_MESSAGE }, { status: 503, headers });
  if (params.scope !== "session" && params.scope !== "conversation" && params.scope !== "support") {
    return NextResponse.json({ error: "Call unavailable." }, { status: 404, headers });
  }
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers });

  let displayName = "Member";
  let title = "Call";
  if (params.scope === "session") {
    const [{ data: allowed }, { data: row }, { data: room }] = await Promise.all([
      supabase.rpc("is_session_member", { p_room_id: params.id }),
      supabase.from("session_members").select("profile:artist_profiles(display_name)").eq("session_room_id", params.id).eq("user_id", user.id).eq("status", "active").maybeSingle(),
      supabase.from("session_rooms").select("title").eq("id", params.id).maybeSingle(),
    ]);
    if (!allowed) return NextResponse.json({ error: "Session unavailable." }, { status: 403, headers });
    const profile = Array.isArray(row?.profile) ? row.profile[0] : row?.profile;
    displayName = (profile as { display_name?: string } | null)?.display_name?.trim() || displayName;
    title = room?.title ?? "Session";
  } else if (params.scope === "conversation") {
    const [{ data: participant }, { data: conversation }] = await Promise.all([
      supabase.from("conversation_participants").select("profile:artist_profiles(display_name)").eq("conversation_id", params.id).eq("user_id", user.id).is("left_at", null).maybeSingle(),
      supabase.from("conversations").select("title").eq("id", params.id).maybeSingle(),
    ]);
    if (!participant) return NextResponse.json({ error: "Conversation unavailable." }, { status: 403, headers });
    const profile = Array.isArray(participant.profile) ? participant.profile[0] : participant.profile;
    displayName = (profile as { display_name?: string } | null)?.display_name?.trim() || displayName;
    title = conversation?.title?.trim() || "Conversation";
  } else {
    const admin = createAdminClient();
    const { data: report } = await admin.from("support_reports").select("user_id, subject").eq("id", params.id).maybeSingle();
    const staff = await requireAdmin();
    if (!report || (report.user_id !== user.id && !staff)) return NextResponse.json({ error: "Support call unavailable." }, { status: 403, headers });
    displayName = staff ? "TEMPO Support" : user.email?.split("@")[0] || "Member";
    title = report.subject || "TEMPO Support";
  }
  const minted = await mintCallToken({
    scope: params.scope,
    targetId: params.id,
    kind: "member",
    id: user.id,
    displayName,
    canPublish: true,
    ttlSeconds: 2 * 60 * 60,
    metadata: { title },
  });
  return NextResponse.json(minted, { headers });
}
