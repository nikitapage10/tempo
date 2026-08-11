import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { logAdminAction } from "@/lib/admin/audit";
import { adminError, adminJson } from "@/lib/admin/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifySupportMember } from "@/lib/admin/support-notifications";

export const dynamic = "force-dynamic";
const statuses = new Set(["open", "in_progress", "resolved"]);

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAdmin();
  if (!access) return adminError("Forbidden.", 403);
  const input = await request.json().catch(() => null);
  const status = typeof input?.status === "string" ? input.status : "";
  const adminNotes = typeof input?.adminNotes === "string" ? input.adminNotes.trim().slice(0, 5000) : null;
  const reply = typeof input?.reply === "string" ? input.reply.trim().slice(0, 5000) : "";
  const media = Array.isArray(input?.media) ? input.media.slice(0, 4).filter((item: unknown) => item && typeof item === "object" && typeof (item as { path?: unknown }).path === "string" && (item as { path: string }).path.startsWith(`messages/${access.user.id}/support/${params.id}/`)) : [];
  if (!statuses.has(status)) return adminError("Invalid support status.", 400);

  const service = createAdminClient();
  const { data: report } = await service.from("support_reports").select("id, user_id, subject").eq("id", params.id).maybeSingle();
  if (!report) return adminError("Support ticket not found.", 404);
  const now = new Date().toISOString();
  const isReadOnly = input?.read === true
    && !reply
    && media.length === 0
    && input?.adminNotes === undefined
    && input?.archived === undefined
    && input?.deleteMessageId === undefined;
  if (isReadOnly) {
    const { error: readError } = await service.from("support_reports").update({ admin_last_read_at: now }).eq("id", params.id);
    return readError ? adminError("Couldn't mark this support ticket as read.", 500) : adminJson({ ok: true });
  }
  const { error } = await service.from("support_reports").update({ status, admin_notes: adminNotes || null, updated_at: now, resolved_at: status === "resolved" ? now : null, resolved_by: status === "resolved" ? access.user.id : null }).eq("id", params.id);
  if (error) return adminError("Couldn’t update this support ticket.", 500);
  if (reply || media.length) {
    const { error: replyError } = await service.from("support_messages").insert({ report_id: params.id, sender_role: "support", sender_user_id: access.user.id, body: reply, media });
    if (replyError) return adminError("The ticket was updated, but the reply could not be delivered. Run migration 036.", 500);
    await notifySupportMember({ reportId: report.id, recipientUserId: report.user_id, subject: report.subject, body: reply || "TEMPO Support sent an attachment." });
  }
  if (typeof input?.archived === "boolean") await service.from("support_reports").update({ admin_archived_at: input.archived ? now : null }).eq("id", params.id);
  if (input?.read === true) await service.from("support_reports").update({ admin_last_read_at: now }).eq("id", params.id);
  if (typeof input?.deleteMessageId === "string") {
    const { data: message } = await service.from("support_messages").select("id, media").eq("id", input.deleteMessageId).eq("report_id", params.id).eq("sender_user_id", access.user.id).maybeSingle();
    if (message) {
      await service.from("support_messages").update({ body: "", media: [], deleted_at: now, deleted_by_user_id: access.user.id }).eq("id", message.id);
      const paths = Array.isArray(message.media) ? message.media.map((item) => typeof item === "string" ? item : item && typeof item === "object" ? (item as { path?: unknown }).path : null).filter((path): path is string => typeof path === "string" && path.startsWith(`messages/${access.user.id}/`)) : [];
      if (paths.length) await service.storage.from("audio").remove(paths);
    }
  }
  await logAdminAction(access.user.id, reply || media.length ? "support.replied" : "support.updated", { type: "support_report", id: params.id }, { status, replied: Boolean(reply || media.length) });
  return adminJson({ ok: true });
}
