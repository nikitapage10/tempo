import { requireAdmin } from "@/lib/admin/guard";
import { logAdminAction } from "@/lib/admin/audit";
import { adminError, adminJson } from "@/lib/admin/http";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const access = await requireAdmin();
  if (!access) return adminError("Forbidden.", 403);

  try {
    const service = createAdminClient();
    const { data: invite, error: findError } = await service
      .from("invites")
      .select("id, code, email")
      .eq("id", params.id)
      .maybeSingle();
    if (findError) throw findError;
    if (!invite) return adminError("Invite not found.", 404);

    const { error: deleteError } = await service
      .from("invites")
      .delete()
      .eq("id", invite.id);
    if (deleteError) throw deleteError;

    await logAdminAction(
      access.user.id,
      "invite.deleted",
      { type: "invite", id: invite.id },
      { code: invite.code, email: invite.email }
    );
    return adminJson({ ok: true });
  } catch {
    return adminError("Couldn’t delete this invite.", 500);
  }
}
