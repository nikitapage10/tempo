import { type NextRequest } from "next/server";
import { logAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { adminError, adminJson } from "@/lib/admin/http";
import { ACCOUNT_EVENT_COLUMNS } from "@/lib/admin/select";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssistantTotals, getInviteForUser, memberAggregates, userProvider } from "@/lib/admin/users";
import type { AdminInviteRole } from "@/lib/api/admin";

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
    const profile = aggregates.profiles.get(user.id);
    const onboarding = aggregates.onboarding.get(user.id);
    return adminJson({ id: user.id, email: user.email ?? "", createdAt: user.created_at, lastSignInAt: user.last_sign_in_at ?? null, emailConfirmedAt: user.email_confirmed_at ?? null, provider: userProvider(user), status: aggregates.flags.get(user.id)?.status ?? "active", memberRole: aggregates.roles.get(user.id) ?? "artist", publicProfile: profile ? { id: profile.id, handle: profile.handle, display_name: profile.display_name, visibility: profile.visibility } : null, trackCount: aggregates.tracks.get(user.id) ?? 0, projectCount: aggregates.projects.get(user.id) ?? 0, storageBytes: aggregates.storage.get(user.id) ?? 0, assistant, invite, onboarding: onboarding ? { eligible: onboarding.eligible, mainTourCompletedAt: onboarding.main_tour_completed_at, checklistSteps: onboarding.checklist_steps.length, checklistDismissedAt: onboarding.checklist_dismissed_at, checklistCompletedAt: onboarding.checklist_completed_at, pageToursCompleted: onboarding.page_tours_completed.length, welcomeMessageSentAt: onboarding.welcome_message_sent_at, lastSeenAt: onboarding.last_seen_at } : null, accountEvents: events.data ?? [] });
  } catch { return adminError("Couldn’t load this member.", 500); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAdmin();
  if (!access) return adminError("Forbidden.", 403);

  const body = await req.json().catch(() => null);
  const memberRole = body?.memberRole as AdminInviteRole | undefined;
  if (!memberRole || !["artist", "team_member", "administrator"].includes(memberRole)) {
    return adminError("Choose a valid member role.", 400);
  }
  if (params.id === access.user.id && memberRole !== "administrator") {
    return adminError("You can’t remove your own admin access.", 400);
  }

  try {
    const service = createAdminClient();
    const { data: target, error: userError } = await service.auth.admin.getUserById(params.id);
    if (userError || !target.user?.email) return adminError("Member not found.", 404);

    const configuredAdmins = new Set(
      (process.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    );
    if (memberRole !== "administrator" && configuredAdmins.has(target.user.email.toLowerCase())) {
      return adminError("This account is protected by the ADMIN_EMAILS configuration.", 400);
    }

    const { data: existingState } = await service
      .from("member_onboarding")
      .select("member_role")
      .eq("user_id", params.id)
      .maybeSingle();
    const { data: existingAdmin } = await service
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", params.id)
      .maybeSingle();
    const previousRole: AdminInviteRole = existingAdmin
      ? "administrator"
      : existingState?.member_role === "team_member"
        ? "team_member"
        : "artist";

    const { error: roleError } = await service.rpc("set_member_role", {
      p_user_id: params.id,
      p_member_role: memberRole,
      p_granted_by: access.user.id,
    });
    if (roleError) throw roleError;

    await logAdminAction(
      access.user.id,
      "member.role_changed",
      { type: "user", id: params.id },
      { previousRole, memberRole },
    );
    return adminJson({ memberRole });
  } catch {
    return adminError("Couldn’t update this member’s role.", 500);
  }
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
