import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/guard";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function POST(_req: NextRequest, { params }: { params: { scope: string; id: string } }) {
  if (params.scope !== "conversation" && params.scope !== "support") return NextResponse.json({ error: "Call unavailable." }, { status: 404, headers });
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers });
  const admin = createAdminClient();

  if (params.scope === "support") {
    const staff = await requireAdmin();
    if (!staff) return NextResponse.json({ error: "Call unavailable." }, { status: 403, headers });
    const { data: report } = await admin.from("support_reports").select("user_id, subject").eq("id", params.id).maybeSingle();
    if (!report) return NextResponse.json({ error: "Support thread unavailable." }, { status: 404, headers });
    const { error } = await admin.from("notifications").insert({
      user_id: report.user_id,
      type: "call_incoming",
      title: "TEMPO Support is calling",
      body: report.subject,
      entity_type: "support_report",
      entity_id: params.id,
      link_url: `/messages?support=${params.id}&answer=1`,
    });
    if (error) return NextResponse.json({ error: "Couldn’t ring this call." }, { status: 500, headers });
    await admin.from("support_messages").insert({ report_id: params.id, sender_role: "support", sender_user_id: user.id, body: "::system::TEMPO Support started a call" });
    return NextResponse.json({ ok: true, notified: 1 }, { headers });
  }

  const { data: caller } = await admin.from("conversation_participants").select("profile_id, profile:artist_profiles(display_name)").eq("conversation_id", params.id).eq("user_id", user.id).is("left_at", null).maybeSingle();
  if (!caller) return NextResponse.json({ error: "Conversation unavailable." }, { status: 403, headers });
  const [{ data: recipients }, { data: conversation }] = await Promise.all([
    admin.from("conversation_participants").select("user_id").eq("conversation_id", params.id).is("left_at", null).neq("user_id", user.id),
    admin.from("conversations").select("title").eq("id", params.id).maybeSingle(),
  ]);
  const profile = Array.isArray(caller.profile) ? caller.profile[0] : caller.profile;
  const name = (profile as { display_name?: string } | null)?.display_name?.trim() || "Someone";
  const title = conversation?.title?.trim() || name;
  const rows = (recipients ?? []).map((recipient) => ({
    user_id: recipient.user_id,
    type: "call_incoming",
    title: `${name} is calling`,
    body: title,
    entity_type: "conversation",
    entity_id: params.id,
    link_url: `/messages?c=${params.id}&answer=1`,
  }));
  if (rows.length) {
    const { error } = await admin.from("notifications").insert(rows);
    if (error) return NextResponse.json({ error: "Couldn’t ring this call." }, { status: 500, headers });
  }
  await admin.from("messages").insert({ conversation_id: params.id, sender_profile_id: caller.profile_id, sender_user_id: user.id, body: `::system::${name} started a call` });
  return NextResponse.json({ ok: true, notified: rows.length }, { headers });
}
