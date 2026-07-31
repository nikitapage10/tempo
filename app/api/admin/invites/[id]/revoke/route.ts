import { requireAdmin } from "@/lib/admin/guard";
import { logAdminAction } from "@/lib/admin/audit";
import { adminError, adminJson } from "@/lib/admin/http";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const access = await requireAdmin(); if (!access) return adminError("Forbidden.", 403);
  try { const { error } = await createAdminClient().from("invites").update({ revoked_at: new Date().toISOString() }).eq("id", params.id); if (error) throw error; await logAdminAction(access.user.id, "invite.revoked", { type: "invite", id: params.id }); return adminJson({ ok: true }); } catch { return adminError("Couldn’t revoke this invite.", 500); }
}
