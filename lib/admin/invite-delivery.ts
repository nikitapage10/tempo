import { sendInviteEmail } from "@/lib/admin/invite-email";
import { createAdminClient } from "@/lib/supabase/admin";
import { INVITE_COLUMNS } from "@/lib/admin/select";

export type DeliverableInvite = { id: string; code: string; email: string | null; expires_at: string | null; send_count: number };

export async function deliverInvite(invite: DeliverableInvite) {
  if (!invite.email) throw new Error("Add an email address before sending this invite.");
  const service = createAdminClient();
  try {
    const sent = await sendInviteEmail({ code: invite.code, email: invite.email, expiresAt: invite.expires_at, idempotencyKey: `invite/${invite.id}/send/${invite.send_count + 1}` });
    const { data, error } = await service.from("invites").update({ last_sent_at: new Date().toISOString(), send_count: invite.send_count + 1, email_provider_id: sent.providerId, last_send_error: null }).eq("id", invite.id).select(INVITE_COLUMNS).single();
    if (error || !data) throw new Error("The invite was sent, but its delivery receipt could not be saved.");
    return { invite: data, link: sent.link };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invite delivery failed.";
    await service.from("invites").update({ last_send_error: message.slice(0, 300) }).eq("id", invite.id);
    throw new Error(message);
  }
}
