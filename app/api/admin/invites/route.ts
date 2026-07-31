import { randomBytes } from "crypto";
import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { logAdminAction } from "@/lib/admin/audit";
import { adminError, adminJson } from "@/lib/admin/http";
import { INVITE_COLUMNS } from "@/lib/admin/select";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliverInvite, type DeliverableInvite } from "@/lib/admin/invite-delivery";
import { inviteDeliveryConfig } from "@/lib/admin/invite-email";

export const dynamic = "force-dynamic";
function code() { const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const bytes = randomBytes(8); const group = (start: number) => Array.from(bytes.subarray(start, start + 4), (b) => alphabet[b % alphabet.length]).join(""); return `TEMPO-${group(0)}-${group(4)}`; }

export async function GET() {
  if (!(await requireAdmin())) return adminError("Forbidden.", 403);
  const { data, error } = await createAdminClient().from("invites").select(INVITE_COLUMNS).order("created_at", { ascending: false });
  return error ? adminError("Couldn’t load invites.", 500) : adminJson({ invites: data ?? [], deliveryConfig: inviteDeliveryConfig() });
}

export async function POST(req: NextRequest) {
  const access = await requireAdmin(); if (!access) return adminError("Forbidden.", 403);
  const body = await req.json().catch(() => null); const email = typeof body?.email === "string" && body.email.trim() ? body.email.trim().toLowerCase() : null; const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null; const expiresAt = typeof body?.expiresAt === "string" && body.expiresAt ? new Date(body.expiresAt).toISOString() : null; const maxUses = Math.min(100, Math.max(1, Number(body?.maxUses) || 1));
  try {
    const service = createAdminClient(); let created = null;
    for (let attempt = 0; attempt < 3 && !created; attempt++) { const { data } = await service.from("invites").insert({ code: code(), email, note, expires_at: expiresAt, max_uses: maxUses, created_by: access.user.id }).select(INVITE_COLUMNS).single(); created = data; }
    if (!created) throw new Error();
    await logAdminAction(access.user.id, "invite.created", { type: "invite", id: created.id }, { email, maxUses, expiresAt });
    let delivery: "sent" | "failed" | "not_requested" = "not_requested";
    let deliveryError: string | null = null;
    if (email) {
      try {
        const result = await deliverInvite(created as DeliverableInvite);
        created = result.invite;
        delivery = "sent";
        await logAdminAction(access.user.id, "invite.sent", { type: "invite", id: created.id }, { email, sendCount: created.send_count });
      } catch (error) {
        delivery = "failed";
        deliveryError = error instanceof Error ? error.message : "Invite delivery failed.";
        await logAdminAction(access.user.id, "invite.send_failed", { type: "invite", id: created.id }, { email });
      }
    }
    return adminJson({ invite: created, delivery, deliveryError }, 201);
  } catch { return adminError("Couldn’t create an invite.", 500); }
}
