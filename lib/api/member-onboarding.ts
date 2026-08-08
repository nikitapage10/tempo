export const STARTER_CHECKLIST_IDS = [
  "review_profile",
  "add_track",
  "upload_tune",
  "shape_board",
  "review_stats",
  "connect_spotify",
] as const;

export type StarterChecklistId = (typeof STARTER_CHECKLIST_IDS)[number];

export type MemberOnboardingState = {
  eligible: boolean;
  memberRole: "artist" | "team_member" | "administrator";
  startedAt: string;
  mainTourCompletedAt: string | null;
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
