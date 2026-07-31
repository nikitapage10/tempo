import { type NextRequest } from "next/server";
import { logAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { adminError, adminJson } from "@/lib/admin/http";
import { ACCOUNT_EVENT_COLUMNS } from "@/lib/admin/select";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssistantTotals, getInviteForUser, memberAggregates, userProvider } from "@/lib/admin/users";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return adminError("Forbidden.", 403);
  try {
    const service = createAdminClient();
    const { data, error } = await service.auth.admin.getUserById(params.id);
    if (error || !data.user) return adminError("Member not found.", 404);
    const user = data.user;
    const [aggregates, assistant, invite, events] = await Promise.all([
      memberAggregates([user.id]), getAssistantTotals(user.id), getInviteForUser(user.id),
      service.from("activity_events").select(ACCOUNT_EVENT_COLUMNS).eq("actor_user_id", user.id).order("created_at", { ascending: false }).limit(20),
    ]);
    return adminJson({ id: user.id, email: user.email ?? "", createdAt: user.created_at, lastSignInAt: user.last_sign_in_at ?? null, emailConfirmedAt: user.email_confirmed_at ?? null, provider: userProvider(user), status: aggregates.flags.get(user.id)?.status ?? "active", publicProfile: aggregates.profiles.get(user.id) ?? null, trackCount: aggregates.tracks.get(user.id) ?? 0, projectCount: aggregates.projects.get(user.id) ?? 0, storageBytes: aggregates.storage.get(user.id) ?? 0, assistant, invite, accountEvents: events.data ?? [] });
  } catch { return adminError("Couldn’t load this member.", 500); }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAdmin(); if (!access) return adminError("Forbidden.", 403);
  const body = await req.json().catch(() => null); const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const service = createAdminClient(); const { data } = await service.auth.admin.getUserById(params.id); const targetEmail = data.user?.email?.toLowerCase();
  if (!targetEmail) return adminError("Member not found.", 404);
  if (params.id === access.user.id) return adminError("You can’t delete your own admin account.", 400);
  if (email !== targetEmail) return adminError("Email confirmation does not match.", 400);
  try { await logAdminAction(access.user.id, "member.deleted", { type: "user", id: params.id }, { email: targetEmail }); const { error } = await service.auth.admin.deleteUser(params.id); if (error) throw error; return adminJson({ ok: true }); } catch { return adminError("Couldn’t delete this member.", 500); }
}
