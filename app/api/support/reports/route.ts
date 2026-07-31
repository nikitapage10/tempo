import { type NextRequest, NextResponse } from "next/server";
import { SUPPORT_MESSAGE_COLUMNS, SUPPORT_REPORT_COLUMNS } from "@/lib/admin/select";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const headers: HeadersInit = { "Cache-Control": "no-store" };
const categories = new Set(["bug", "help", "feedback"]);

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers });
  const service = createAdminClient();
  const archived = request.nextUrl.searchParams.get("archived") === "true";
  let reportQuery = service.from("support_reports").select(SUPPORT_REPORT_COLUMNS).eq("user_id", user.id).order("last_message_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  reportQuery = archived ? reportQuery.not("member_archived_at", "is", null) : reportQuery.is("member_archived_at", null);
  const { data: reports, error } = await reportQuery;
  if (error) return NextResponse.json({ error: "Couldn’t load support conversations. Run migration 036 if needed." }, { status: 500, headers });
  const ids = (reports ?? []).map((report) => report.id);
  const { data: messages, error: messageError } = ids.length
    ? await service.from("support_messages").select(SUPPORT_MESSAGE_COLUMNS).in("report_id", ids).is("deleted_at", null).order("created_at", { ascending: true })
    : { data: [], error: null };
  if (messageError) return NextResponse.json({ error: "Couldn’t load support messages." }, { status: 500, headers });
  return NextResponse.json({ reports: (reports ?? []).map((report) => ({ ...report, messages: (messages ?? []).filter((message) => message.report_id === report.id) })) }, { headers });
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers });
  const body = await request.json().catch(() => null);
  const category = typeof body?.category === "string" ? body.category : "";
  const subject = typeof body?.subject === "string" ? body.subject.trim().slice(0, 160) : "";
  const details = typeof body?.details === "string" ? body.details.trim().slice(0, 5000) : "";
  const pageUrl = typeof body?.pageUrl === "string" ? body.pageUrl.slice(0, 500) : null;
  const userAgent = typeof body?.userAgent === "string" ? body.userAgent.slice(0, 500) : null;
  const source = body?.source === "assistant" ? "assistant" : "manual";
  if (!categories.has(category) || subject.length < 3 || details.length < 3) return NextResponse.json({ error: "Add a category, subject, and a few details." }, { status: 400, headers });
  const id = crypto.randomUUID();
  const { error } = await supabase.from("support_reports").insert({ id, user_id: user.id, email: user.email ?? null, category, subject, details, page_url: pageUrl, user_agent: userAgent, source, last_message_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: "Couldn’t send your report. Run migration 036 if it has not been applied." }, { status: 500, headers });
  return NextResponse.json({ ok: true, id }, { status: 201, headers });
}
