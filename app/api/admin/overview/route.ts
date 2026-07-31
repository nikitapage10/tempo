import { requireAdmin } from "@/lib/admin/guard";
import { adminError, adminJson } from "@/lib/admin/http";
import { FILE_SIZE_COLUMN, ID_COLUMN, INVITE_COLUMNS } from "@/lib/admin/select";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireAdmin())) return adminError("Forbidden.", 403);
  try {
    const service = createAdminClient();
    const now = Date.now();
    const week = new Date(now - 7 * 86400000).toISOString();
    const month = new Date(now - 30 * 86400000).toISOString();
    const { data: authPage, error: authError } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (authError) throw authError;
    const users = authPage.users;
    const [{ count: reports }, { data: inviteRows }, { data: files }] = await Promise.all([
      service.from("content_reports").select(ID_COLUMN, { count: "exact", head: true }).eq("status", "open"),
      service.from("invites").select(INVITE_COLUMNS).is("revoked_at", null).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`),
      service.from("versions").select(FILE_SIZE_COLUMN),
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
      openReports: reports ?? 0,
      outstandingInvites: (inviteRows ?? []).filter((invite) => invite.used_count < invite.max_uses).length,
      totalStorageBytes: (files ?? []).reduce((sum, row) => sum + (Number(row.file_size) || 0), 0),
      signups,
    });
  } catch {
    return adminError("Couldn’t load the admin overview.", 500);
  }
}
