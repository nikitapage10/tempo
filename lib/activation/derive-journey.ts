/**
 * Pure activation-journey derivation — 01-PRODUCT-AND-UX-SPEC.md §6.2 and
 * 02-TECHNICAL-AND-DATA-DESIGN.md §5. Takes facts the member could already
 * read themselves and returns the single current recommendation. Never
 * writes anything; never derives completion from product-event telemetry
 * (analytics observes product state, product state does not depend on
 * analytics). Only display preferences (snooze/hide/acknowledge) live in
 * the database — progress itself is always recomputed from these facts.
 */

export const ACTIVATION_DEFINITION_VERSION = 1;

export type RecommendedStep =
  | "bring_in_song"
  | "name_next_move"
  | "work_a_session"
  | "upload_bounce"
  | "get_ears_on_it"
  | "waiting_for_feedback"
  | "close_the_loop"
  | "loop_complete";

export type JourneyState = "active" | "waiting" | "complete" | "partial";

export type EligibleTrack = {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  isReleased: boolean;
  hasNextMove: boolean;
  nextMoveDueAt: string | null;
  isBlockedOrWaiting: boolean;
  hasCompletedFocusSession: boolean;
  hasVersion: boolean;
  hasGuestLinkOrCollaborator: boolean;
  hasFeedback: boolean;
  hasUnresolvedFeedback: boolean;
};

export type ActivationFacts = {
  tracks: EligibleTrack[];
  /** True if any source query for the facts above failed — degrades gracefully. */
  warnings?: string[];
};

export type CompletedOutcome =
  | "track_exists"
  | "next_move_set"
  | "focus_session_completed"
  | "bounce_uploaded"
  | "feedback_loop_completed";

export type ActivationJourney = {
  definitionVersion: number;
  completedSteps: CompletedOutcome[];
  recommendedStep: RecommendedStep;
  reasonCode: string;
  reason: string;
  targetTrackId: string | null;
  targetTrackTitle: string | null;
  state: JourneyState;
  warnings: string[];
};

/**
 * Track selection: explainable, deterministic priority — never a hidden
 * numeric rank (spec §6.2 rule 1-4).
 */
function selectEligibleTrack(tracks: EligibleTrack[]): EligibleTrack | null {
  if (tracks.length === 0) return null;

  const blockedWithFeedback = tracks
    .filter((t) => t.isBlockedOrWaiting && t.hasUnresolvedFeedback)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  if (blockedWithFeedback.length > 0) return blockedWithFeedback[0];

  const withDueDate = tracks
    .filter((t) => t.nextMoveDueAt)
    .sort((a, b) => (a.nextMoveDueAt as string).localeCompare(b.nextMoveDueAt as string));
  if (withDueDate.length > 0) return withDueDate[0];

  const mostRecentlyUpdated = [...tracks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (mostRecentlyUpdated.length > 0) return mostRecentlyUpdated[0];

  const mostRecentlyCreated = [...tracks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return mostRecentlyCreated[0] ?? null;
}

export function deriveActivationJourney(facts: ActivationFacts): ActivationJourney {
  const warnings = facts.warnings ?? [];
  const catalogTracks = facts.tracks;
  // Released songs have already left the active workflow. They belong in the
  // catalog, but the guide must not send an artist back to manufacture a new
  // next move for them.
  const tracks = catalogTracks.filter((track) => !track.isReleased);

  const completedSteps: CompletedOutcome[] = [];
  if (tracks.length > 0) completedSteps.push("track_exists");
  if (tracks.some((t) => t.hasNextMove)) completedSteps.push("next_move_set");
  if (tracks.some((t) => t.hasCompletedFocusSession)) completedSteps.push("focus_session_completed");
  if (tracks.some((t) => t.hasVersion)) completedSteps.push("bounce_uploaded");
  if (tracks.some((t) => t.hasFeedback)) completedSteps.push("feedback_loop_completed");

  // No tracks at all — the very first step, no track selection needed.
  if (tracks.length === 0 && catalogTracks.length === 0) {
    return {
      definitionVersion: ACTIVATION_DEFINITION_VERSION,
      completedSteps,
      recommendedStep: "bring_in_song",
      reasonCode: "no_tracks",
      reason: "Bring in your first song to start the loop.",
      targetTrackId: null,
      targetTrackTitle: null,
      state: "active",
      warnings,
    };
  }

  if (tracks.length === 0) {
    return {
      definitionVersion: ACTIVATION_DEFINITION_VERSION,
      completedSteps: ["track_exists"],
      recommendedStep: "loop_complete",
      reasonCode: "released_catalog_only",
      reason: "Your released catalog is already complete. Start a new track when you’re ready.",
      targetTrackId: null,
      targetTrackTitle: null,
      state: "complete",
      warnings,
    };
  }

  // Loop completion is decided by the per-track walk below, not shortcut
  // here — "every outcome has happened somewhere" is not the same as
  // "nothing is left to act on" (unresolved feedback on the selected track
  // must still surface as close_the_loop even once the outcome checklist
  // is technically satisfied).
  const track = selectEligibleTrack(tracks);
  if (!track) {
    return {
      definitionVersion: ACTIVATION_DEFINITION_VERSION,
      completedSteps,
      recommendedStep: "bring_in_song",
      reasonCode: "no_eligible_track",
      reason: "Bring in your first song to start the loop.",
      targetTrackId: null,
      targetTrackTitle: null,
      state: "partial",
      warnings,
    };
  }

  if (!track.hasNextMove) {
    return {
      definitionVersion: ACTIVATION_DEFINITION_VERSION,
      completedSteps,
      recommendedStep: "name_next_move",
      reasonCode: "no_next_move",
      reason: `Name the next move for “${track.title}” so you know where to pick it back up.`,
      targetTrackId: track.id,
      targetTrackTitle: track.title,
      state: "active",
      warnings,
    };
  }

  if (!track.hasCompletedFocusSession) {
    return {
      definitionVersion: ACTIVATION_DEFINITION_VERSION,
      completedSteps,
      recommendedStep: "work_a_session",
      reasonCode: "no_focus_session",
      reason: "Work one focused session on this track.",
      targetTrackId: track.id,
      targetTrackTitle: track.title,
      state: "active",
      warnings,
    };
  }

  if (!track.hasVersion) {
    return {
      definitionVersion: ACTIVATION_DEFINITION_VERSION,
      completedSteps,
      recommendedStep: "upload_bounce",
      reasonCode: "no_bounce",
      reason: "Upload the latest bounce for this track.",
      targetTrackId: track.id,
      targetTrackTitle: track.title,
      state: "active",
      warnings,
    };
  }

  if (!track.hasGuestLinkOrCollaborator) {
    return {
      definitionVersion: ACTIVATION_DEFINITION_VERSION,
      completedSteps,
      recommendedStep: "get_ears_on_it",
      reasonCode: "no_share",
      reason: "Put another pair of ears on it.",
      targetTrackId: track.id,
      targetTrackTitle: track.title,
      state: "active",
      warnings,
    };
  }

  if (!track.hasFeedback) {
    return {
      definitionVersion: ACTIVATION_DEFINITION_VERSION,
      completedSteps,
      recommendedStep: "waiting_for_feedback",
      reasonCode: "waiting_for_feedback",
      reason: "Waiting for feedback on the shared bounce.",
      targetTrackId: track.id,
      targetTrackTitle: track.title,
      state: "waiting",
      warnings,
    };
  }

  if (track.hasUnresolvedFeedback) {
    return {
      definitionVersion: ACTIVATION_DEFINITION_VERSION,
      completedSteps,
      recommendedStep: "close_the_loop",
      reasonCode: "unresolved_feedback",
      reason: "Close the loop on the feedback you received.",
      targetTrackId: track.id,
      targetTrackTitle: track.title,
      state: "active",
      warnings,
    };
  }

  // This track individually is done, but the account-wide "allComplete"
  // check above didn't trip — some other track still needs an earlier step.
  // Recurse on the remaining tracks only (defensive; should be rare).
  const remaining = tracks.filter((t) => t.id !== track.id);
  if (remaining.length > 0) {
    return deriveActivationJourney({ tracks: remaining, warnings });
  }

  return {
    definitionVersion: ACTIVATION_DEFINITION_VERSION,
    completedSteps,
    recommendedStep: "loop_complete",
    reasonCode: "loop_complete",
    reason: "You've completed the core TEMPO loop.",
    targetTrackId: null,
    targetTrackTitle: null,
    state: "complete",
    warnings,
  };
}
