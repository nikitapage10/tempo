import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { adminError, adminJson } from "@/lib/admin/http";
import { SUPPORT_REPORT_COLUMNS } from "@/lib/admin/select";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) return adminError("Forbidden.", 403);
  const status = request.nextUrl.searchParams.get("status") ?? "open";
  let query = createAdminClient().from("support_reports").select(SUPPORT_REPORT_COLUMNS).order("created_at", { ascending: false }).limit(200);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  return error ? adminError("Couldn’t load support reports.", 500) : adminJson({ reports: data ?? [] });
}
