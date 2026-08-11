import { type NextRequest, NextResponse } from "next/server";
import { SUPPORT_MESSAGE_COLUMNS } from "@/lib/admin/select";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { notifySupportAdmins } from "@/lib/admin/support-notifications";

export const dynamic = "force-dynamic";
const headers: HeadersInit = { "Cache-Control": "no-store" };

async function memberReport(reportId: string) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const service = createAdminClient();
  const { data: report } = await service.from("support_reports").select("id, subject").eq("id", reportId).eq("user_id", user.id).maybeSingle();
  return report ? { user, report, service } : null;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await memberReport(params.id);
  if (!access) return NextResponse.json({ error: "Support ticket not found." }, { status: 404, headers });
  const before = request.nextUrl.searchParams.get("before");
  const search = request.nextUrl.searchParams.get("q")?.trim().slice(0, 200) ?? "";
  if (search) {
    const memberClient = createServerClient();
    const { data, error } = await memberClient.rpc("search_support_messages", { p_report_id: params.id, p_query: search, p_limit: 100 });
    if (error) return NextResponse.json({ error: "Couldn't search support messages. Run migration 082 if it has not been applied." }, { status: 500, headers });
    return NextResponse.json({ messages: (data ?? []).reverse(), hasMore: false }, { headers });
  }
  let query = access.service.from("support_messages").select(SUPPORT_MESSAGE_COLUMNS).eq("report_id", params.id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(50);
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Couldn't load support messages." }, { status: 500, headers });
  return NextResponse.json({ messages: (data ?? []).reverse(), hasMore: (data?.length ?? 0) === 50 }, { headers });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await memberReport(params.id);
  if (!access) return NextResponse.json({ error: "Support ticket not found." }, { status: 404, headers });
  const input = await request.json().catch(() => null);
  const body = typeof input?.body === "string" ? input.body.trim().slice(0, 5000) : "";
  const media = Array.isArray(input?.media) ? input.media.slice(0, 4).filter((item: unknown) => item && typeof item === "object" && typeof (item as { path?: unknown }).path === "string" && (item as { path: string }).path.startsWith(`messages/${access.user.id}/support/${params.id}/`)) : [];
  const replyToMessageId = typeof input?.replyToMessageId === "string" ? input.replyToMessageId : null;
  if (!body && media.length === 0) return NextResponse.json({ error: "Write a reply or attach a file first." }, { status: 400, headers });
  if (replyToMessageId) {
    const { data: target } = await access.service.from("support_messages").select("id").eq("id", replyToMessageId).eq("report_id", params.id).maybeSingle();
    if (!target) return NextResponse.json({ error: "Reply target not found." }, { status: 400, headers });
  }
  const { error } = await access.service.from("support_messages").insert({ report_id: params.id, sender_role: "member", sender_user_id: access.user.id, body, media, reply_to_message_id: replyToMessageId });
  if (error) return NextResponse.json({ error: "Couldn't send your reply. Run migration 082 if it has not been applied." }, { status: 500, headers });
  await notifySupportAdmins({ reportId: params.id, subject: access.report.subject });
  return NextResponse.json({ ok: true }, { status: 201, headers });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await memberReport(params.id);
  if (!access) return NextResponse.json({ error: "Support ticket not found." }, { status: 404, headers });
  const input = await request.json().catch(() => null);
  const messageId = typeof input?.messageId === "string" ? input.messageId : "";
  const body = typeof input?.body === "string" ? input.body.trim().slice(0, 5000) : "";
  if (!body) return NextResponse.json({ error: "A message needs text." }, { status: 400, headers });
  const { data: message } = await access.service.from("support_messages").select("id").eq("id", messageId).eq("report_id", params.id).eq("sender_user_id", access.user.id).is("deleted_at", null).maybeSingle();
  if (!message) return NextResponse.json({ error: "Message not found." }, { status: 404, headers });
  const { error } = await access.service.from("support_messages").update({ body, edited_at: new Date().toISOString() }).eq("id", message.id);
  return error ? NextResponse.json({ error: "Couldn't edit that message." }, { status: 500, headers }) : NextResponse.json({ ok: true }, { headers });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await memberReport(params.id);
  if (!access) return NextResponse.json({ error: "Support ticket not found." }, { status: 404, headers });
  const input = await request.json().catch(() => null);
  const messageId = typeof input?.messageId === "string" ? input.messageId : "";
  const { data: message } = await access.service.from("support_messages").select("id, media").eq("id", messageId).eq("report_id", params.id).eq("sender_user_id", access.user.id).is("deleted_at", null).maybeSingle();
  if (!message) return NextResponse.json({ error: "Message not found." }, { status: 404, headers });
  const { error } = await access.service.from("support_messages").update({ body: "", media: [], deleted_at: new Date().toISOString(), deleted_by_user_id: access.user.id }).eq("id", message.id);
  if (error) return NextResponse.json({ error: "Couldn't delete that message." }, { status: 500, headers });
  const paths = Array.isArray(message.media) ? message.media.map((item) => typeof item === "string" ? item : item && typeof item === "object" ? (item as { path?: unknown }).path : null).filter((path): path is string => typeof path === "string" && path.startsWith(`messages/${access.user.id}/`)) : [];
  if (paths.length) await access.service.storage.from("audio").remove(paths);
  return NextResponse.json({ ok: true }, { headers });
}
