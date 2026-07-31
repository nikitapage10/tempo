import { createAdminClient } from "@/lib/supabase/admin";

export async function logAdminAction(
  adminUserId: string,
  action: string,
  target: { type: string; id: string },
  meta: Record<string, unknown> = {}
) {
  const { error } = await createAdminClient().from("admin_audit_log").insert({
    admin_user_id: adminUserId,
    action,
    target_type: target.type,
    target_id: target.id,
    meta,
  });
  if (error) throw new Error("Could not write the admin audit log.");
}
