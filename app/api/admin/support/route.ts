import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { adminError, adminJson } from "@/lib/admin/http";
import { SUPPORT_MESSAGE_COLUMNS, SUPPORT_REPORT_COLUMNS } from "@/lib/admin/select";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) return adminError("Forbidden.", 403);
  const status = request.nextUrl.searchParams.get("status") ?? "open";
  const archived = request.nextUrl.searchParams.get("archived") === "true";
  const service = createAdminClient();
  let query = service.from("support_reports").select(SUPPORT_REPORT_COLUMNS).order("last_message_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(200);
  if (status) query = query.eq("status", status);
  query = archived ? query.not("admin_archived_at", "is", null) : query.is("admin_archived_at", null);
  const { data, error } = await query;
  if (error) return adminError("Couldn’t load support reports. Run migration 036 if needed.", 500);
  const reports = data ?? [];
  const ids = reports.map((report) => report.id);
  const { data: messageRows, error: messageError } = ids.length
    ? await service.from("support_messages").select(SUPPORT_MESSAGE_COLUMNS).in("report_id", ids).is("deleted_at", null).order("created_at", { ascending: true })
    : { data: [], error: null };
  if (messageError) return adminError("Couldn’t load support conversations. Run migration 036.", 500);
  return adminJson({ reports: reports.map((report) => ({ ...report, messages: (messageRows ?? []).filter((message) => message.report_id === report.id) })) });
}
