import { requireAdmin } from "@/lib/admin/guard";
import { logAdminAction } from "@/lib/admin/audit";
import { adminError, adminJson } from "@/lib/admin/http";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const access = await requireAdmin(); if (!access) return adminError("Forbidden.", 403);
  try {
    const service = createAdminClient(); const { error } = await service.auth.admin.updateUserById(params.id, { ban_duration: "none" }); if (error) throw error;
    const { error: flagError } = await service.from("account_flags").upsert({ user_id: params.id, status: "active", reason: null, changed_at: new Date().toISOString(), changed_by: access.user.id }); if (flagError) throw flagError;
    await logAdminAction(access.user.id, "member.reactivated", { type: "user", id: params.id }); return adminJson({ ok: true });
  } catch { return adminError("Couldn’t reactivate this member.", 500); }
}
