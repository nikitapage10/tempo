import { createAdminClient } from "@/lib/supabase/admin";

type SupportNotice = { reportId: string; subject: string; body?: string; recipientUserId?: string };

export async function notifySupportMember(input: SupportNotice) {
  if (!input.recipientUserId) return;
  const service = createAdminClient();
  await service.from("notifications").insert({ user_id: input.recipientUserId, type: "support_reply", title: "New message from TEMPO Support", body: input.body || input.subject, entity_type: "support_report", entity_id: input.reportId, link_url: `/messages?support=${input.reportId}`, group_key: `support:${input.reportId}` });
}

export async function notifySupportAdmins(input: SupportNotice & { isNew?: boolean }) {
  const service = createAdminClient();
  const { data: admins } = await service.from("platform_admins").select("user_id");
  if (!admins?.length) return;
  await service.from("notifications").insert(admins.map((admin) => ({ user_id: admin.user_id, type: input.isNew ? "support_new" : "support_member_reply", title: input.isNew ? "New support ticket" : "New support reply", body: input.subject, entity_type: "support_report", entity_id: input.reportId, link_url: "/admin/support", group_key: `admin-support:${input.reportId}` })));
}
