import { type NextRequest } from "next/server";
import { logAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { adminError, adminJson } from "@/lib/admin/http";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAdmin(); if (!access) return adminError("Forbidden.", 403);
  if (params.id === access.user.id) return adminError("You can’t suspend your own admin account.", 400);
  const body = await req.json().catch(() => null); const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (!reason) return adminError("Add a suspension reason.", 400);
  try {
    const service = createAdminClient(); const { error } = await service.auth.admin.updateUserById(params.id, { ban_duration: "876000h" }); if (error) throw error;
    const { error: flagError } = await service.from("account_flags").upsert({ user_id: params.id, status: "suspended", reason, changed_at: new Date().toISOString(), changed_by: access.user.id }); if (flagError) throw flagError;
    await logAdminAction(access.user.id, "member.suspended", { type: "user", id: params.id }, { reason }); return adminJson({ ok: true });
  } catch { return adminError("Couldn’t suspend this member.", 500); }
}
