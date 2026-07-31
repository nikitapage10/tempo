import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { adminError, adminJson } from "@/lib/admin/http";
import { AUDIT_COLUMNS } from "@/lib/admin/select";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return adminError("Forbidden.", 403);
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1); const from = (page - 1) * PAGE_SIZE;
  const { data, error, count } = await createAdminClient().from("admin_audit_log").select(AUDIT_COLUMNS, { count: "exact" }).order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  return error ? adminError("Couldn’t load the audit log.", 500) : adminJson({ entries: data ?? [], page, totalPages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)) });
}
