import { NextResponse, type NextRequest } from "next/server";
import { STARTER_CHECKLIST_IDS } from "@/lib/api/member-onboarding";
import { provisionStarterCommunity } from "@/lib/onboarding-starter-community";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const headers: HeadersInit = { "Cache-Control": "no-store" };
const allowedChecklistIds = new Set<string>(STARTER_CHECKLIST_IDS);
const allowedPageTours = new Set([
  "calendar",
  "board",
  "tracks",
  "projects",
  "tasks",
  "artist",
  "social",
  "scenes",
  "stats",
  "settings",
]);

type Row = {
  user_id: string;
  invite_id: string | null;
  member_role: "artist" | "team_member" | "administrator";
  eligible: boolean;
  started_at: string;
  main_tour_completed_at: string | null;
  checklist_opened_at: string | null;
  checklist_steps: string[];
  checklist_dismissed_at: string | null;
  checklist_completed_at: string | null;
  page_tours_completed: string[];
  page_tours_skipped: string[];
  welcome_connected_at: string | null;
  welcome_message_sent_at: string | null;
  last_seen_at: string;
};

async function currentUser() {
  const session = createServerClient();
  const { data: { user } } = await session.auth.getUser();
  return user;
}

async function stateFor(userId: string) {
  const service = createAdminClient();
  // Best effort: this also creates the mutual follow and welcome thread once
  // both the member and inviter have an artist profile.
  await service.rpc("provision_member_onboarding", { p_user_id: userId });
  // The starter community is deliberately best-effort. A profile may not exist
  // on the earliest request, and the next onboarding read safely retries it.
  await provisionStarterCommunity(service, userId).catch((error) => {
    console.error("[onboarding] starter community provisioning failed", error);
  });
  const { data, error } = await service
    .from("member_onboarding")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error || !data) throw error ?? new Error("Missing onboarding state");

  return serialize(data as Row);
}

function serialize(row: Row) {
  return {
    eligible: row.eligible,
    memberRole: row.member_role ?? "artist",
    startedAt: row.started_at,
    mainTourCompletedAt: row.main_tour_completed_at,
    checklistOpenedAt: row.checklist_opened_at,
    checklistSteps: (row.checklist_steps ?? []).filter((id) => allowedChecklistIds.has(id)),
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
    await service.rpc("provision_member_onboarding", { p_user_id: user.id });
    const { data: existing, error: readError } = await service
      .from("member_onboarding")
      .select("*")
      .eq("user_id", user.id)
      .single();
    if (readError || !existing) throw readError;

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { last_seen_at: now };
    if (body.mainTourCompleted === true && !existing.main_tour_completed_at) {
      patch.main_tour_completed_at = now;
    }
    if (body.checklistOpened === true && !existing.checklist_opened_at) {
      patch.checklist_opened_at = now;
    }
    if (typeof body.checklistDismissed === "boolean") {
      patch.checklist_dismissed_at = body.checklistDismissed ? now : null;
    }

    if (Array.isArray(body.checklistSteps)) {
      const steps = Array.from(new Set(
        body.checklistSteps.filter((id: unknown): id is string =>
          typeof id === "string" && allowedChecklistIds.has(id),
        ),
      ));
      patch.checklist_steps = steps;
      patch.checklist_completed_at =
        steps.length === STARTER_CHECKLIST_IDS.length ? now : null;
    }

    if (typeof body.completedPageTour === "string" && allowedPageTours.has(body.completedPageTour)) {
      patch.page_tours_completed = Array.from(new Set([
        ...(existing.page_tours_completed ?? []),
        body.completedPageTour,
      ]));
    }
    if (typeof body.skippedPageTour === "string" && allowedPageTours.has(body.skippedPageTour)) {
      patch.page_tours_skipped = Array.from(new Set([
        ...(existing.page_tours_skipped ?? []),
        body.skippedPageTour,
      ]));
    }

    const { error: updateError } = await service
      .from("member_onboarding")
      .update(patch)
      .eq("user_id", user.id);
    if (updateError) throw updateError;
    return NextResponse.json(await stateFor(user.id), { headers });
  } catch {
    return NextResponse.json({ error: "Couldn’t save onboarding progress." }, { status: 500, headers });
  }
}
