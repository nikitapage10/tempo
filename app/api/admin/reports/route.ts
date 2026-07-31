import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { adminError, adminJson } from "@/lib/admin/http";
import { REPORT_COLUMNS, REPORT_COMMENT_COLUMNS, REPORT_POST_COLUMNS, USER_PROFILE_COLUMNS } from "@/lib/admin/select";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return adminError("Forbidden.", 403);
  const status = req.nextUrl.searchParams.get("status") ?? "open";
  try {
    const service = createAdminClient(); let query = service.from("content_reports").select(REPORT_COLUMNS).order("created_at", { ascending: false }); if (status) query = query.eq("status", status); const { data, error } = await query; if (error) throw error;
    const reports = await Promise.all((data ?? []).map(async (report) => {
      let target: unknown = null;
      if (report.target_type === "post") { const result = await service.from("posts").select(REPORT_POST_COLUMNS).eq("id", report.target_id).maybeSingle(); target = result.data; }
      if (report.target_type === "post_comment") { const result = await service.from("post_comments").select(REPORT_COMMENT_COLUMNS).eq("id", report.target_id).maybeSingle(); target = result.data; }
      if (report.target_type === "profile") { const result = await service.from("artist_profiles").select(USER_PROFILE_COLUMNS).eq("id", report.target_id).neq("visibility", "private").maybeSingle(); target = result.data; }
      return { ...report, target };
    }));
    return adminJson({ reports });
  } catch { return adminError("Couldn’t load reports.", 500); }
}
