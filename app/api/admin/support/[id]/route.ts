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
  const body = await request.json().catch(() => null);
  const status = typeof body?.status === "string" ? body.status : "";
  const adminNotes = typeof body?.adminNotes === "string" ? body.adminNotes.trim().slice(0, 5000) : null;
  if (!statuses.has(status)) return adminError("Invalid support status.", 400);
  const now = new Date().toISOString();
  const { error } = await createAdminClient().from("support_reports").update({ status, admin_notes: adminNotes || null, updated_at: now, resolved_at: status === "resolved" ? now : null, resolved_by: status === "resolved" ? access.user.id : null }).eq("id", params.id);
  if (error) return adminError("Couldn’t update this support report.", 500);
  await logAdminAction(access.user.id, "support.updated", { type: "support_report", id: params.id }, { status });
  return adminJson({ ok: true });
}
