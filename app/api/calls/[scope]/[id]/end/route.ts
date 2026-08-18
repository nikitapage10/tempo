import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/guard";
import { formatDuration } from "@/lib/format";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest, { params }: { params: { scope: string; id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers });
  const body = (await req.json().catch(() => ({}))) as { durationSec?: unknown };
  const seconds = typeof body.durationSec === "number" ? Math.max(0, Math.floor(body.durationSec)) : 0;
  const admin = createAdminClient();

  if (params.scope === "support") {
    const staff = await requireAdmin();
    if (!staff) return NextResponse.json({ error: "Call unavailable." }, { status: 403, headers });
    await admin.from("support_messages").insert({
      report_id: params.id,
      sender_role: "support",
      sender_user_id: user.id,
      body: `::system::Call ended · ${formatDuration(seconds)}`,
    });
    return NextResponse.json({ ok: true }, { headers });
  }
  if (params.scope !== "conversation") return NextResponse.json({ error: "Call unavailable." }, { status: 404, headers });
  const { data: participant } = await admin.from("conversation_participants").select("profile_id").eq("conversation_id", params.id).eq("user_id", user.id).is("left_at", null).maybeSingle();
  if (!participant) return NextResponse.json({ error: "Conversation unavailable." }, { status: 403, headers });
  await admin.from("messages").insert({
    conversation_id: params.id,
    sender_profile_id: participant.profile_id,
    sender_user_id: user.id,
    body: `::system::Call ended · ${formatDuration(seconds)}`,
  });
  return NextResponse.json({ ok: true }, { headers });
}
