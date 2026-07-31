import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { logAdminAction } from "@/lib/admin/audit";
import { adminError, adminJson } from "@/lib/admin/http";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const statuses = new Set(["open", "in_progress", "resolved"]);

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAdmin();
  if (!access) return adminError("Forbidden.", 403);
  const input = await request.json().catch(() => null);
  const status = typeof input?.status === "string" ? input.status : "";
  const adminNotes = typeof input?.adminNotes === "string" ? input.adminNotes.trim().slice(0, 5000) : null;
  const reply = typeof input?.reply === "string" ? input.reply.trim().slice(0, 5000) : "";
  if (!statuses.has(status)) return adminError("Invalid support status.", 400);

  const service = createAdminClient();
  const { data: report } = await service.from("support_reports").select("id").eq("id", params.id).maybeSingle();
  if (!report) return adminError("Support ticket not found.", 404);
  const now = new Date().toISOString();
  const { error } = await service.from("support_reports").update({ status, admin_notes: adminNotes || null, updated_at: now, resolved_at: status === "resolved" ? now : null, resolved_by: status === "resolved" ? access.user.id : null }).eq("id", params.id);
  if (error) return adminError("Couldn’t update this support ticket.", 500);
  if (reply) {
    const { error: replyError } = await service.from("support_messages").insert({ report_id: params.id, sender_role: "support", sender_user_id: access.user.id, body: reply });
    if (replyError) return adminError("The ticket was updated, but the reply could not be delivered. Run migration 036.", 500);
  }
  await logAdminAction(access.user.id, reply ? "support.replied" : "support.updated", { type: "support_report", id: params.id }, { status, replied: Boolean(reply) });
  return adminJson({ ok: true });
}
