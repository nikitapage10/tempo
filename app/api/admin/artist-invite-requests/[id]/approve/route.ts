import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/admin/guard";
import { logAdminAction } from "@/lib/admin/audit";
import { adminError, adminJson } from "@/lib/admin/http";
import { INVITE_COLUMNS } from "@/lib/admin/select";
import {
  notifyRequesterOfArtistInviteDecision,
} from "@/lib/admin/invite-activity";
import { deliverInvite, type DeliverableInvite } from "@/lib/admin/invite-delivery";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function code() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  const group = (start: number) =>
    Array.from(bytes.subarray(start, start + 4), (b) => alphabet[b % alphabet.length]).join("");
  return `TEMPO-${group(0)}-${group(4)}`;
}

function missingTable(message: string): boolean {
  return /schema cache|does not exist|artist_invite_requests/i.test(message);
}

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const access = await requireAdmin();
  if (!access) return adminError("Forbidden.", 403);

  const service = createAdminClient();
  const { data: request, error } = await service
    .from("artist_invite_requests")
    .select("id, email, note, status, requested_by")
    .eq("id", params.id)
    .maybeSingle();
  if (error) {
    if (missingTable(error.message)) {
      return adminError("Run migration 093 in Supabase first.", 503);
    }
    return adminError("Couldn’t load that request.", 500);
  }
  if (!request) return adminError("Request not found.", 404);
  if (request.status !== "pending") {
    return adminError("This request was already reviewed.", 409);
  }

  try {
    let created = null;
    for (let attempt = 0; attempt < 3 && !created; attempt++) {
      const { data } = await service
        .from("invites")
        .insert({
          code: code(),
          email: request.email,
          note: request.note,
          member_role: "artist",
          created_by: access.user.id,
          max_uses: 1,
        })
        .select(INVITE_COLUMNS)
        .single();
      created = data;
    }
    if (!created) throw new Error("Couldn’t create the invite.");

    let delivery: "sent" | "failed" = "failed";
    try {
      const result = await deliverInvite(created as DeliverableInvite);
      created = result.invite;
      delivery = "sent";
    } catch {
      delivery = "failed";
    }

    const { error: updateError } = await service
      .from("artist_invite_requests")
      .update({
        status: "approved",
        reviewed_by: access.user.id,
        reviewed_at: new Date().toISOString(),
        invite_id: created.id,
      })
      .eq("id", request.id);
    if (updateError) throw updateError;

    await logAdminAction(
      access.user.id,
      "artist_invite_request.approved",
      { type: "artist_invite_request", id: request.id },
      { email: request.email, inviteId: created.id, delivery }
    );
    try {
      await notifyRequesterOfArtistInviteDecision({
        service,
        userId: request.requested_by,
        email: request.email,
        approved: true,
      });
    } catch {
      /* notification is best-effort */
    }

    return adminJson({ ok: true, delivery, invite: created });
  } catch {
    return adminError("Couldn’t approve this invite.", 500);
  }
}
