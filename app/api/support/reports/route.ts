import { type NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const headers: HeadersInit = { "Cache-Control": "no-store" };
const categories = new Set(["bug", "help", "feedback"]);

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
  const { error } = await supabase.from("support_reports").insert({ id, user_id: user.id, email: user.email ?? null, category, subject, details, page_url: pageUrl, user_agent: userAgent, source });
  if (error) return NextResponse.json({ error: "Couldn’t send your report." }, { status: 500, headers });
  return NextResponse.json({ ok: true, id }, { status: 201, headers });
}
