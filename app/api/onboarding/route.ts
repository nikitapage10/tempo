import { NextResponse, type NextRequest } from "next/server";
import {
  PAGE_TOUR_IDS,
  PRO_PAGE_TOUR_IDS,
  clearedProTourProgress,
  starterChecklistIdsFor,
} from "@/lib/api/member-onboarding";
import {
  hasRealArtistProfile,
  isRealArtistOnNetwork,
  provisionStarterCommunity,
} from "@/lib/onboarding-starter-community";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const headers: HeadersInit = { "Cache-Control": "no-store" };
const allowedPageTours = new Set<string>(PAGE_TOUR_IDS);

type Row = {
  user_id: string;
  invite_id: string | null;
  member_role: "artist" | "team_member" | "administrator";
  eligible: boolean;
  started_at: string;
  main_tour_completed_at: string | null;
  pro_tour_choice: "guides" | "skip_all" | null;
  checklist_opened_at: string | null;
  checklist_steps: string[];
  checklist_dismissed_at: string | null;
  checklist_completed_at: string | null;
  page_tours_completed: string[];
  page_tours_skipped: string[];
  welcome_connected_at: string | null;
  welcome_message_sent_at: string | null;
  starter_community_provisioned_at: string | null;
  last_seen_at: string;
};

async function currentUser() {
  const session = createServerClient();
  const { data: { user } } = await session.auth.getUser();
  return user;
}

/** Reads the onboarding row, ensuring it exists first. */
async function readState(service: ReturnType<typeof createAdminClient>, userId: string) {
  // One round trip, all of it server-side in Postgres: creates the row on
  // first sight, refreshes last_seen_at, and settles the inviter follow and
  // welcome thread once both sides have an artist profile.
  if (await hasRealArtistProfile(service, userId)) {
    await service.rpc("provision_member_onboarding", { p_user_id: userId });
  } else {
    // Keep onboarding readable while a member explores the demo before their
    // real profile exists. Calling the legacy RPC here would let the demo
    // profile become the actor in the automatic inviter follow.
    const { data: existing, error: readError } = await service
      .from("member_onboarding")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (readError) throw readError;
    if (existing) {
      const { error } = await service
        .from("member_onboarding")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (error) throw error;
    } else {
      const { error } = await service.from("member_onboarding").insert({
        user_id: userId,
        eligible: false,
        main_tour_completed_at: new Date().toISOString(),
        checklist_dismissed_at: new Date().toISOString(),
      });
      if (error) throw error;
    }
  }
  const { data, error } = await service
    .from("member_onboarding")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error || !data) throw error ?? new Error("Missing onboarding state");
  return data as Row;
}

/**
 * Seeds the starter community once, then never again.
 *
 * This costs ~25 sequential round trips. It is genuinely first-run-only work,
 * but this endpoint runs on every authenticated page load, so without the
 * marker every navigation paid for it again. Mutates `row` in place so the
 * caller can serialize the state it already holds.
 *
 * The marker is only written once provisioning reports it ran to completion,
 * so an account still too new to seed retries on the next request — the
 * original best-effort behaviour, minus the repetition.
 */
async function ensureStarterCommunity(
  service: ReturnType<typeof createAdminClient>,
  row: Row,
  userId: string
) {
  if (row.starter_community_provisioned_at) return;
  try {
    // Social and Scene membership are opt-in. Merely loading an authenticated
    // page must not populate follows, feed posts, or Scene membership.
    if (!(await isRealArtistOnNetwork(service, userId))) return;
    if (!(await provisionStarterCommunity(service, userId))) return;
    const provisionedAt = new Date().toISOString();
    await service
      .from("member_onboarding")
      .update({ starter_community_provisioned_at: provisionedAt })
      .eq("user_id", userId);
    row.starter_community_provisioned_at = provisionedAt;
  } catch (error) {
    console.error("[onboarding] starter community provisioning failed", error);
  }
}

async function passageRolesFor(
  service: ReturnType<typeof createAdminClient>,
  userId: string,
  memberRole: Row["member_role"]
) {
  if (memberRole !== "team_member") return [];
  const { data, error } = await service
    .from("member_passages")
    .select("role_titles, role_title_other")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return [];
  const roles = [
    ...((data.role_titles as string[] | null) ?? []),
    typeof data.role_title_other === "string" ? data.role_title_other : "",
  ];
  return Array.from(new Set(roles.map((role) => role.trim()).filter(Boolean)));
}

async function stateFor(userId: string) {
  const service = createAdminClient();
  const row = await readState(service, userId);
  await ensureStarterCommunity(service, row, userId);
  return serialize(row, await passageRolesFor(service, userId, row.member_role));
}

function serialize(row: Row, passageRoles: string[] = []) {
  const checklistIds = new Set<string>(starterChecklistIdsFor(row.member_role));
  return {
    eligible: row.eligible,
    memberRole: row.member_role ?? "artist",
    startedAt: row.started_at,
    mainTourCompletedAt: row.main_tour_completed_at,
    proTourChoice: row.pro_tour_choice ?? null,
    checklistOpenedAt: row.checklist_opened_at,
    passageRoles,
    checklistSteps: (row.checklist_steps ?? []).filter((id) => checklistIds.has(id)),
    checklistDismissedAt: row.checklist_dismissed_at,
    checklistCompletedAt: row.checklist_completed_at,
    pageToursCompleted: row.page_tours_completed ?? [],
    pageToursSkipped: row.page_tours_skipped ?? [],
    welcomeConnectedAt: row.welcome_connected_at,
    welcomeMessageSentAt: row.welcome_message_sent_at,
    lastSeenAt: row.last_seen_at,
  };
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers });
  try {
    return NextResponse.json(await stateFor(user.id), { headers });
  } catch {
    return NextResponse.json({ error: "Onboarding is not available yet." }, { status: 503, headers });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid onboarding update." }, { status: 400, headers });
  }

  try {
    const service = createAdminClient();
    const existing = await readState(service, user.id);

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { last_seen_at: now };
    if (body.mainTourCompleted === true && !existing.main_tour_completed_at) {
      patch.main_tour_completed_at = now;
    }
    if (
      existing.member_role === "team_member" &&
      !existing.pro_tour_choice &&
      (body.proTourChoice === "guides" || body.proTourChoice === "skip_all")
    ) {
      patch.pro_tour_choice = body.proTourChoice;
    }
    if (body.resetProTour === true && existing.member_role === "team_member") {
      const cleared = clearedProTourProgress({
        pageToursCompleted: existing.page_tours_completed ?? [],
        pageToursSkipped: existing.page_tours_skipped ?? [],
      });
      patch.pro_tour_choice = null;
      patch.page_tours_completed = cleared.pageToursCompleted;
      patch.page_tours_skipped = cleared.pageToursSkipped;
    }
    if (body.skipAllPageTours === true) {
      const ids = existing.member_role === "team_member"
        ? PRO_PAGE_TOUR_IDS
        : PAGE_TOUR_IDS;
      const currentSkipped = Array.isArray(patch.page_tours_skipped)
        ? (patch.page_tours_skipped as string[])
        : (existing.page_tours_skipped ?? []);
      patch.page_tours_skipped = Array.from(new Set([
        ...currentSkipped,
        ...ids,
      ]));
    }
    if (body.checklistOpened === true && !existing.checklist_opened_at) {
      patch.checklist_opened_at = now;
    }
    if (typeof body.checklistDismissed === "boolean") {
      patch.checklist_dismissed_at = body.checklistDismissed ? now : null;
    }

    if (Array.isArray(body.checklistSteps)) {
      const requiredChecklistIds = starterChecklistIdsFor(existing.member_role);
      const allowedChecklistIds = new Set<string>(requiredChecklistIds);
      const steps = Array.from(new Set(
        body.checklistSteps.filter((id: unknown): id is string =>
          typeof id === "string" && allowedChecklistIds.has(id),
        ),
      ));
      patch.checklist_steps = steps;
      patch.checklist_completed_at =
        requiredChecklistIds.every((id) => steps.includes(id)) ? now : null;
    }

    if (typeof body.completedPageTour === "string" && allowedPageTours.has(body.completedPageTour)) {
      patch.page_tours_completed = Array.from(new Set([
        ...(existing.page_tours_completed ?? []),
        body.completedPageTour,
      ]));
    }
    if (
      body.skipAllPageTours !== true &&
      typeof body.skippedPageTour === "string" &&
      allowedPageTours.has(body.skippedPageTour)
    ) {
      patch.page_tours_skipped = Array.from(new Set([
        ...(existing.page_tours_skipped ?? []),
        body.skippedPageTour,
      ]));
    }

    // `.select()` returns the saved row, so the response no longer costs a
    // second provision-and-read cycle on top of the one above.
    const { data: updated, error: updateError } = await service
      .from("member_onboarding")
      .update(patch)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (updateError || !updated) throw updateError ?? new Error("Missing onboarding state");

    const row = updated as Row;
    await ensureStarterCommunity(service, row, user.id);
    const passageRoles = await passageRolesFor(service, user.id, row.member_role);
    return NextResponse.json(serialize(row, passageRoles), { headers });
  } catch {
    return NextResponse.json({ error: "Couldn’t save onboarding progress." }, { status: 500, headers });
  }
}
