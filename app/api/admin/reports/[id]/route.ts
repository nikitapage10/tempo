import { type NextRequest } from "next/server";
import { logAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { adminError, adminJson } from "@/lib/admin/http";
import { REPORT_COLUMNS, REPORT_COMMENT_COLUMNS, REPORT_POST_COLUMNS, USER_PROFILE_COLUMNS } from "@/lib/admin/select";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAdmin(); if (!access) return adminError("Forbidden.", 403);
  const body = await req.json().catch(() => null); const action = body?.action as string;
  if (!["hide", "dismiss", "suspend_author"].includes(action)) return adminError("Invalid moderation action.", 400);
  try {
    const service = createAdminClient(); const { data: report } = await service.from("content_reports").select(REPORT_COLUMNS).eq("id", params.id).maybeSingle(); if (!report) return adminError("Report not found.", 404);
    if (action === "hide") { if (report.target_type !== "post") return adminError("Only reported posts can be hidden.", 400); const { error } = await service.from("posts").update({ deleted_at: new Date().toISOString() }).eq("id", report.target_id); if (error) throw error; }
    if (action === "suspend_author") {
      let profileId: string | null = null;
      if (report.target_type === "profile") profileId = report.target_id;
      if (report.target_type === "post") { const { data } = await service.from("posts").select(REPORT_POST_COLUMNS).eq("id", report.target_id).maybeSingle(); profileId = data?.author_profile_id ?? null; }
      if (report.target_type === "post_comment") { const { data } = await service.from("post_comments").select(REPORT_COMMENT_COLUMNS).eq("id", report.target_id).maybeSingle(); profileId = data?.author_profile_id ?? null; }
      const { data: profile } = profileId ? await service.from("artist_profiles").select(USER_PROFILE_COLUMNS).eq("id", profileId).maybeSingle() : { data: null };
      if (!profile?.owner_user_id) return adminError("The reported author no longer exists.", 404);
      const { error } = await service.auth.admin.updateUserById(profile.owner_user_id, { ban_duration: "876000h" }); if (error) throw error;
      await service.from("account_flags").upsert({ user_id: profile.owner_user_id, status: "suspended", reason: `Moderation report ${report.id}`, changed_at: new Date().toISOString(), changed_by: access.user.id });
    }
    const status = action === "dismiss" ? "dismissed" : "actioned"; const { error: reviewError } = await service.from("content_reports").update({ status, reviewed_by: access.user.id, reviewed_at: new Date().toISOString(), action_taken: action }).eq("id", report.id); if (reviewError) throw reviewError;
    await logAdminAction(access.user.id, `report.${action}`, { type: "report", id: report.id }, { targetType: report.target_type, targetId: report.target_id }); return adminJson({ ok: true });
  } catch { return adminError("Couldn’t complete that moderation action.", 500); }
}
