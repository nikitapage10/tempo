import { requireAdmin } from "@/lib/admin/guard";
import { adminError, adminJson } from "@/lib/admin/http";
import {
  FILE_SIZE_COLUMN,
  ID_COLUMN,
  INVITE_COLUMNS,
  OVERVIEW_AUDIT_COLUMNS,
  OVERVIEW_REPORT_COLUMNS,
  OVERVIEW_SUPPORT_COLUMNS,
  USER_ID_COLUMN,
} from "@/lib/admin/select";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireAdmin())) return adminError("Forbidden.", 403);
  try {
    const service = createAdminClient();
    const now = Date.now();
    const week = new Date(now - 7 * 86400000).toISOString();
    const month = new Date(now - 30 * 86400000).toISOString();
    const { data: authPage, error: authError } = await service.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (authError) throw authError;
    const users = authPage.users;
    const [
      { count: reports },
      { count: supportReports },
      { count: suspended },
      { data: inviteRows },
      { data: versions },
      { data: assets },
      { data: recentSupport },
      { data: recentReports },
      { data: recentAudit },
    ] = await Promise.all([
      service.from("content_reports").select(ID_COLUMN, { count: "exact", head: true }).eq("status", "open"),
      service
        .from("support_reports")
        .select(ID_COLUMN, { count: "exact", head: true })
        .in("status", ["open", "in_progress"])
        .is("admin_archived_at", null),
      service
        .from("account_flags")
        .select(USER_ID_COLUMN, { count: "exact", head: true })
        .eq("status", "suspended"),
      service.from("invites").select(INVITE_COLUMNS).is("revoked_at", null).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`),
      service.from("versions").select(FILE_SIZE_COLUMN),
      service.from("assets").select(FILE_SIZE_COLUMN),
      service
        .from("support_reports")
        .select(OVERVIEW_SUPPORT_COLUMNS)
        .in("status", ["open", "in_progress"])
        .is("admin_archived_at", null)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(5),
      service
        .from("content_reports")
        .select(OVERVIEW_REPORT_COLUMNS)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(5),
      service
        .from("admin_audit_log")
        .select(OVERVIEW_AUDIT_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    const signups = Array.from({ length: 90 }, (_, index) => {
      const d = new Date(now - (89 - index) * 86400000);
      const key = d.toISOString().slice(0, 10);
      return { date: key, count: users.filter((u) => u.created_at.slice(0, 10) === key).length };
    });
    return adminJson({
      totalMembers: users.length,
      signupsWeek: users.filter((u) => u.created_at >= week).length,
      signupsMonth: users.filter((u) => u.created_at >= month).length,
      active7: users.filter((u) => (u.last_sign_in_at ?? "") >= week).length,
      active30: users.filter((u) => (u.last_sign_in_at ?? "") >= month).length,
      suspendedMembers: suspended ?? 0,
      openReports: reports ?? 0,
      openSupportReports: supportReports ?? 0,
      outstandingInvites: (inviteRows ?? []).filter((invite) => invite.used_count < invite.max_uses).length,
      totalStorageBytes: [...(versions ?? []), ...(assets ?? [])].reduce(
        (sum, row) => sum + (Number(row.file_size) || 0),
        0
      ),
      signups,
      recentSupport: recentSupport ?? [],
      recentReports: recentReports ?? [],
      recentAudit: recentAudit ?? [],
    });
  } catch {
    return adminError("Couldn’t load the admin overview.", 500);
  }
}
