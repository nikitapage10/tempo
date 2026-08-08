import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACCOUNT_FLAG_COLUMNS, ASSISTANT_USAGE_COLUMNS, INVITE_COLUMNS, INVITE_REDEMPTION_COLUMNS, USER_ID_COLUMN, USER_PROFILE_COLUMNS, VERSION_OWNER_STORAGE_COLUMNS } from "@/lib/admin/select";

type PublicProfile = { id: string; owner_user_id: string; handle: string | null; display_name: string; visibility: string };
type Flag = { user_id: string; status: "active" | "suspended" };
type MemberRole = "artist" | "team_member" | "administrator";
type Onboarding = { user_id: string; member_role: MemberRole; eligible: boolean; started_at: string; main_tour_completed_at: string | null; checklist_steps: string[]; checklist_dismissed_at: string | null; checklist_completed_at: string | null; page_tours_completed: string[]; welcome_message_sent_at: string | null; last_seen_at: string };

function increment(map: Map<string, number>, id: string | null | undefined, value = 1) { if (id) map.set(id, (map.get(id) ?? 0) + value); }
export function userProvider(user: User) { return String(user.app_metadata?.provider ?? user.identities?.[0]?.provider ?? "email"); }

export async function memberAggregates(userIds: string[]) {
  const service = createAdminClient();
  if (!userIds.length) return { profiles: new Map<string, PublicProfile>(), flags: new Map<string, Flag>(), tracks: new Map<string, number>(), projects: new Map<string, number>(), storage: new Map<string, number>(), onboarding: new Map<string, Onboarding>(), roles: new Map<string, MemberRole>() };
  const [profilesResult, flagsResult, tracksResult, projectsResult, versionsResult, onboardingResult, adminsResult] = await Promise.all([
    service.from("artist_profiles").select(USER_PROFILE_COLUMNS).in("owner_user_id", userIds).neq("visibility", "private"),
    service.from("account_flags").select(ACCOUNT_FLAG_COLUMNS).in("user_id", userIds),
    service.from("tracks").select(USER_ID_COLUMN).in("user_id", userIds),
    service.from("projects").select(USER_ID_COLUMN).in("user_id", userIds),
    service.from("versions").select(VERSION_OWNER_STORAGE_COLUMNS).in("tracks.user_id", userIds),
    service.from("member_onboarding").select("user_id, member_role, eligible, started_at, main_tour_completed_at, checklist_steps, checklist_dismissed_at, checklist_completed_at, page_tours_completed, welcome_message_sent_at, last_seen_at").in("user_id", userIds),
    service.from("platform_admins").select("user_id").in("user_id", userIds),
  ]);
  const profiles = new Map<string, PublicProfile>();
  for (const p of profilesResult.data ?? []) if (!profiles.has(p.owner_user_id)) profiles.set(p.owner_user_id, p as PublicProfile);
  const flags = new Map<string, Flag>((flagsResult.data ?? []).map((f) => [f.user_id, f as Flag]));
  const tracks = new Map<string, number>(); for (const row of tracksResult.data ?? []) increment(tracks, row.user_id);
  const projects = new Map<string, number>(); for (const row of projectsResult.data ?? []) increment(projects, row.user_id);
  const storage = new Map<string, number>();
  for (const row of versionsResult.data ?? []) { const relation = row.tracks as unknown as { user_id: string } | { user_id: string }[]; const owner = Array.isArray(relation) ? relation[0]?.user_id : relation?.user_id; increment(storage, owner, Number(row.file_size) || 0); }
  const onboarding = new Map<string, Onboarding>((onboardingResult.data ?? []).map((row) => [row.user_id, row as Onboarding]));
  const roles = new Map<string, MemberRole>();
  for (const id of userIds) roles.set(id, onboarding.get(id)?.member_role ?? "artist");
  for (const admin of adminsResult.data ?? []) roles.set(admin.user_id, "administrator");
  return { profiles, flags, tracks, projects, storage, onboarding, roles };
}

export async function getInviteForUser(userId: string) {
  const service = createAdminClient();
  const { data: redemption } = await service.from("invite_redemptions").select(INVITE_REDEMPTION_COLUMNS).eq("user_id", userId).order("redeemed_at", { ascending: false }).limit(1).maybeSingle();
  if (!redemption) return null;
  const { data: invite } = await service.from("invites").select(INVITE_COLUMNS).eq("id", redemption.invite_id).maybeSingle();
  return invite ? { code: invite.code, memberRole: invite.member_role ?? "artist", redeemedAt: redemption.redeemed_at } : null;
}

export async function getAssistantTotals(userId: string) {
  const { data } = await createAdminClient().from("assistant_usage").select(ASSISTANT_USAGE_COLUMNS).eq("user_id", userId);
  return (data ?? []).reduce((total, row) => ({ messages: total.messages + row.messages, escalations: total.escalations + row.escalations }), { messages: 0, escalations: 0 });
}
