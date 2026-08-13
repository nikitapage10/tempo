import { requireAdmin } from "@/lib/admin/guard";
import { adminError, adminJson } from "@/lib/admin/http";

export const dynamic = "force-dynamic";

/**
 * Lightweight platform-admin probe for the product UI (profile menu, etc.).
 * Same gate as /admin — table row or ADMIN_EMAILS bootstrap — without pulling
 * overview payloads just to decide whether to show a link.
 */
export async function GET() {
  const access = await requireAdmin();
  if (!access) return adminError("Forbidden.", 403);
  return adminJson({ admin: true });
}
