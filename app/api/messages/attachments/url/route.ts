import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const headers: HeadersInit = { "Cache-Control": "no-store" };

function hasOwnedPath(row: { media: unknown; sender_user_id: string | null }, path: string) {
  if (!row.sender_user_id || !path.startsWith(`messages/${row.sender_user_id}/`)) return false;
  return Array.isArray(row.media) && row.media.some((item) => item === path || (item && typeof item === "object" && (item as { path?: unknown }).path === path));
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers });
  const input = await request.json().catch(() => null);
  const scope = input?.scope === "support" ? "support" : input?.scope === "direct" ? "direct" : input?.scope === "scene" ? "scene" : null;
  const threadId = typeof input?.threadId === "string" ? input.threadId : "";
  const path = typeof input?.path === "string" ? input.path : "";
  if (!scope || !threadId || !path.startsWith("messages/")) return NextResponse.json({ error: "Invalid attachment request." }, { status: 400, headers });

  const service = createAdminClient();
  let allowed = false;
  if (scope === "direct" || scope === "scene") {
    const { data: participant } = await service.from("conversation_participants").select("conversation_id").eq("conversation_id", threadId).eq("user_id", user.id).is("left_at", null).maybeSingle();
    if (participant) {
      const { data: rows } = await service.from("messages").select("media, sender_user_id").eq("conversation_id", threadId).is("deleted_at", null);
      allowed = (rows ?? []).some((row) => hasOwnedPath(row, path));
    }
  } else {
    const [{ data: report }, admin] = await Promise.all([
      service.from("support_reports").select("id, user_id").eq("id", threadId).maybeSingle(),
      requireAdmin(),
    ]);
    if (report && (report.user_id === user.id || Boolean(admin))) {
      const { data: rows } = await service.from("support_messages").select("media, sender_user_id").eq("report_id", threadId).is("deleted_at", null);
      allowed = (rows ?? []).some((row) => hasOwnedPath(row, path));
    }
  }
  if (!allowed) return NextResponse.json({ error: "Attachment not found." }, { status: 404, headers });
  const { data, error } = await service.storage.from("audio").createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return NextResponse.json({ error: "Couldn’t open this attachment." }, { status: 500, headers });
  return NextResponse.json({ url: data.signedUrl }, { headers });
}
