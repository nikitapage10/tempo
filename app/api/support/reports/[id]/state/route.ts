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
  const service = createAdminClient();
  const changes: Record<string, string | null> = {};
  if (typeof input?.archived === "boolean") changes.member_archived_at = input.archived ? new Date().toISOString() : null;
  if (input?.read === true) changes.member_last_read_at = new Date().toISOString();
  if (!Object.keys(changes).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400, headers });
  const { error } = await service.from("support_reports").update(changes).eq("id", params.id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Couldn’t update this support conversation." }, { status: 500, headers });
  return NextResponse.json({ ok: true }, { headers });
}
