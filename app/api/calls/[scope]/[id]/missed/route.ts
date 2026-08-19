import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function POST(_req: NextRequest, { params }: { params: { scope: string; id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers });
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 60_000).toISOString();

  if (params.scope === "support") {
    const { data: report } = await admin.from("support_reports").select("user_id").eq("id", params.id).eq("user_id", user.id).maybeSingle();
    if (!report) return NextResponse.json({ error: "Support call unavailable." }, { status: 403, headers });
    const { data: existing } = await admin.from("support_messages").select("id").eq("report_id", params.id).eq("body", "::system::Missed call").gte("created_at", cutoff).limit(1);
    if (!existing?.length) await admin.from("support_messages").insert({ report_id: params.id, sender_role: "member", sender_user_id: user.id, body: "::system::Missed call" });
    return NextResponse.json({ ok: true }, { headers });
  }
  if (params.scope !== "conversation") return NextResponse.json({ error: "Call unavailable." }, { status: 404, headers });
  const { data: participant } = await admin.from("conversation_participants").select("profile_id").eq("conversation_id", params.id).eq("user_id", user.id).is("left_at", null).maybeSingle();
  if (!participant) return NextResponse.json({ error: "Conversation unavailable." }, { status: 403, headers });
  const { data: existing } = await admin.from("messages").select("id").eq("conversation_id", params.id).eq("body", "::system::Missed call").gte("created_at", cutoff).limit(1);
  if (!existing?.length) {
    await admin.from("messages").insert({ conversation_id: params.id, sender_profile_id: participant.profile_id, sender_user_id: user.id, body: "::system::Missed call" });
  }
  return NextResponse.json({ ok: true }, { headers });
}
