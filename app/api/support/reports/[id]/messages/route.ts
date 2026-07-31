import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const headers: HeadersInit = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers });
  const input = await request.json().catch(() => null);
  const body = typeof input?.body === "string" ? input.body.trim().slice(0, 5000) : "";
  const media = Array.isArray(input?.media) ? input.media.slice(0, 4).filter((item: unknown) => item && typeof item === "object" && typeof (item as { path?: unknown }).path === "string" && (item as { path: string }).path.startsWith(`messages/${user.id}/support/${params.id}/`)) : [];
  if (!body && media.length === 0) return NextResponse.json({ error: "Write a reply or attach a file first." }, { status: 400, headers });
  const service = createAdminClient();
  const { data: report } = await service.from("support_reports").select("id").eq("id", params.id).eq("user_id", user.id).maybeSingle();
  if (!report) return NextResponse.json({ error: "Support ticket not found." }, { status: 404, headers });
  const { error } = await service.from("support_messages").insert({ report_id: report.id, sender_role: "member", sender_user_id: user.id, body, media });
  if (error) return NextResponse.json({ error: "Couldn’t send your reply. Run migration 036 if it has not been applied." }, { status: 500, headers });
  return NextResponse.json({ ok: true }, { status: 201, headers });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers });
  const input = await request.json().catch(() => null);
  const messageId = typeof input?.messageId === "string" ? input.messageId : "";
  const service = createAdminClient();
  const { data: report } = await service.from("support_reports").select("id").eq("id", params.id).eq("user_id", user.id).maybeSingle();
  if (!report) return NextResponse.json({ error: "Support ticket not found." }, { status: 404, headers });
  const { data: message } = await service.from("support_messages").select("id, media").eq("id", messageId).eq("report_id", report.id).eq("sender_user_id", user.id).maybeSingle();
  if (!message) return NextResponse.json({ error: "Message not found." }, { status: 404, headers });
  const { error } = await service.from("support_messages").update({ deleted_at: new Date().toISOString() }).eq("id", message.id);
  if (error) return NextResponse.json({ error: "Couldn’t delete that message." }, { status: 500, headers });
  const paths = Array.isArray(message.media) ? message.media.map((item) => typeof item === "string" ? item : item && typeof item === "object" ? (item as { path?: unknown }).path : null).filter((path): path is string => typeof path === "string" && path.startsWith(`messages/${user.id}/`)) : [];
  if (paths.length) await service.storage.from("audio").remove(paths);
  return NextResponse.json({ ok: true }, { headers });
}
