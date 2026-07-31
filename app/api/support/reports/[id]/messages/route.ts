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
  if (!body) return NextResponse.json({ error: "Write a reply first." }, { status: 400, headers });
  const service = createAdminClient();
  const { data: report } = await service.from("support_reports").select("id").eq("id", params.id).eq("user_id", user.id).maybeSingle();
  if (!report) return NextResponse.json({ error: "Support ticket not found." }, { status: 404, headers });
  const { error } = await service.from("support_messages").insert({ report_id: report.id, sender_role: "member", sender_user_id: user.id, body });
  if (error) return NextResponse.json({ error: "Couldn’t send your reply. Run migration 036 if it has not been applied." }, { status: 500, headers });
  return NextResponse.json({ ok: true }, { status: 201, headers });
}
