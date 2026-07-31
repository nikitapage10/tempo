import { requireAdmin } from "@/lib/admin/guard";
import { logAdminAction } from "@/lib/admin/audit";
import { deliverInvite, type DeliverableInvite } from "@/lib/admin/invite-delivery";
import { adminError, adminJson } from "@/lib/admin/http";
import { INVITE_COLUMNS } from "@/lib/admin/select";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const access = await requireAdmin();
  if (!access) return adminError("Forbidden.", 403);
  const { data: invite } = await createAdminClient().from("invites").select(INVITE_COLUMNS).eq("id", params.id).maybeSingle();
  if (!invite) return adminError("Invite not found.", 404);
  if (invite.revoked_at || invite.used_count >= invite.max_uses) return adminError("This invite is no longer available.", 409);
  try {
    const result = await deliverInvite(invite as DeliverableInvite);
    await logAdminAction(access.user.id, "invite.sent", { type: "invite", id: invite.id }, { email: invite.email, sendCount: result.invite.send_count });
    return adminJson({ invite: result.invite });
  } catch (error) {
    await logAdminAction(access.user.id, "invite.send_failed", { type: "invite", id: invite.id }, { email: invite.email });
    return adminError(error instanceof Error ? error.message : "Couldn’t send this invite.", 502);
  }
}
