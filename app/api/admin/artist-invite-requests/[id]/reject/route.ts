import { requireAdmin } from "@/lib/admin/guard";
import { logAdminAction } from "@/lib/admin/audit";
import { adminError, adminJson } from "@/lib/admin/http";
import { notifyRequesterOfArtistInviteDecision } from "@/lib/admin/invite-activity";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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
    .select("id, email, status, requested_by")
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

  const { error: updateError } = await service
    .from("artist_invite_requests")
    .update({
      status: "rejected",
      reviewed_by: access.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", request.id);
  if (updateError) return adminError("Couldn’t reject this invite.", 500);

  await logAdminAction(
    access.user.id,
    "artist_invite_request.rejected",
    { type: "artist_invite_request", id: request.id },
    { email: request.email }
  );
  try {
    await notifyRequesterOfArtistInviteDecision({
      service,
      userId: request.requested_by,
      email: request.email,
      approved: false,
    });
  } catch {
    /* notification is best-effort */
  }

  return adminJson({ ok: true });
}
