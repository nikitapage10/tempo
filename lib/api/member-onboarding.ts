export const ARTIST_STARTER_CHECKLIST_IDS = [
  "review_profile",
  "add_track",
  "upload_tune",
  "shape_board",
  "review_stats",
  "connect_spotify",
] as const;

export const PRO_STARTER_CHECKLIST_IDS = [
  "pro_review_profile",
  "pro_review_roster",
  "pro_first_followup",
  "pro_key_date",
  "pro_work_view",
  "pro_notifications",
] as const;

export const STARTER_CHECKLIST_IDS = [
  ...ARTIST_STARTER_CHECKLIST_IDS,
  ...PRO_STARTER_CHECKLIST_IDS,
] as const;

export type StarterChecklistId = (typeof STARTER_CHECKLIST_IDS)[number];
export type OnboardingMemberRole = "artist" | "team_member" | "administrator";

export function starterChecklistIdsFor(role: OnboardingMemberRole) {
  return role === "team_member"
    ? PRO_STARTER_CHECKLIST_IDS
    : ARTIST_STARTER_CHECKLIST_IDS;
}

export const ARTIST_PAGE_TOUR_IDS = [
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
] as const;

export const PRO_PAGE_TOUR_IDS = [
  "pro-today",
  "pro-calendar",
  "pro-projects",
  "pro-tasks",
  "pro-team",
  "pro-profile",
  "pro-social",
  "pro-scenes",
  "pro-settings",
] as const;

export const PAGE_TOUR_IDS = [
  ...ARTIST_PAGE_TOUR_IDS,
  ...PRO_PAGE_TOUR_IDS,
] as const;

export type MemberOnboardingState = {
  eligible: boolean;
  memberRole: OnboardingMemberRole;
  /** Self-described Passage roles; personalization only, never authority. */
  passageRoles: string[];
  startedAt: string;
  mainTourCompletedAt: string | null;
  /** Durable, Pro-only choice. Kept separate from the artist Origin tour. */
  proTourChoice: "guides" | "skip_all" | null;
  checklistOpenedAt: string | null;
  checklistSteps: StarterChecklistId[];
  checklistDismissedAt: string | null;
  checklistCompletedAt: string | null;
  pageToursCompleted: string[];
  pageToursSkipped: string[];
  welcomeConnectedAt: string | null;
  welcomeMessageSentAt: string | null;
  lastSeenAt: string;
};

export type MemberOnboardingPatch = {
  mainTourCompleted?: boolean;
  proTourChoice?: "guides" | "skip_all";
  skipAllPageTours?: boolean;
  checklistOpened?: boolean;
  checklistDismissed?: boolean;
  checklistSteps?: StarterChecklistId[];
  completedPageTour?: string;
  skippedPageTour?: string;
};

async function onboardingFetch<T>(init?: RequestInit): Promise<T> {
  const response = await fetch("/api/onboarding", {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? "Couldn’t update onboarding.");
  return body as T;
}

export function fetchMemberOnboarding(): Promise<MemberOnboardingState> {
  return onboardingFetch<MemberOnboardingState>();
}

export function updateMemberOnboarding(
  patch: MemberOnboardingPatch,
): Promise<MemberOnboardingState> {
  return onboardingFetch<MemberOnboardingState>({
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}
