import { describe, expect, it } from "vitest";
import { deriveActivationJourney, type EligibleTrack } from "../../lib/activation/derive-journey";

function track(overrides: Partial<EligibleTrack> = {}): EligibleTrack {
  return {
    id: "t1",
    title: "Untitled song",
    updatedAt: "2026-08-01T00:00:00Z",
    createdAt: "2026-08-01T00:00:00Z",
    isReleased: false,
    hasNextMove: false,
    nextMoveDueAt: null,
    isBlockedOrWaiting: false,
    hasCompletedFocusSession: false,
    hasVersion: false,
    hasGuestLinkOrCollaborator: false,
    hasFeedback: false,
    hasUnresolvedFeedback: false,
    ...overrides,
  };
}

describe("deriveActivationJourney — step-by-step progression", () => {
  it("no tracks -> bring_in_song", () => {
    const j = deriveActivationJourney({ tracks: [] });
    expect(j.recommendedStep).toBe("bring_in_song");
    expect(j.state).toBe("active");
    expect(j.completedSteps).toEqual([]);
  });

  it("track with no next move -> name_next_move", () => {
    const j = deriveActivationJourney({
      tracks: [track({ title: "New chorus" })],
    });
    expect(j.recommendedStep).toBe("name_next_move");
    expect(j.completedSteps).toEqual(["track_exists"]);
    expect(j.targetTrackTitle).toBe("New chorus");
    expect(j.reason).toContain("New chorus");
  });

  it("next move set, no focus session -> work_a_session", () => {
    const j = deriveActivationJourney({ tracks: [track({ hasNextMove: true })] });
    expect(j.recommendedStep).toBe("work_a_session");
  });

  it("focus session done, no bounce -> upload_bounce", () => {
    const j = deriveActivationJourney({
      tracks: [track({ hasNextMove: true, hasCompletedFocusSession: true })],
    });
    expect(j.recommendedStep).toBe("upload_bounce");
  });

  it("bounce exists, no share -> get_ears_on_it", () => {
    const j = deriveActivationJourney({
      tracks: [track({ hasNextMove: true, hasCompletedFocusSession: true, hasVersion: true })],
    });
    expect(j.recommendedStep).toBe("get_ears_on_it");
  });

  it("shared, no feedback yet -> waiting_for_feedback (state=waiting)", () => {
    const j = deriveActivationJourney({
      tracks: [
        track({
          hasNextMove: true,
          hasCompletedFocusSession: true,
          hasVersion: true,
          hasGuestLinkOrCollaborator: true,
        }),
      ],
    });
    expect(j.recommendedStep).toBe("waiting_for_feedback");
    expect(j.state).toBe("waiting");
  });

  it("feedback received but unresolved -> close_the_loop", () => {
    const j = deriveActivationJourney({
      tracks: [
        track({
          hasNextMove: true,
          hasCompletedFocusSession: true,
          hasVersion: true,
          hasGuestLinkOrCollaborator: true,
          hasFeedback: true,
          hasUnresolvedFeedback: true,
        }),
      ],
    });
    expect(j.recommendedStep).toBe("close_the_loop");
  });

  it("every outcome complete -> loop_complete", () => {
    const j = deriveActivationJourney({
      tracks: [
        track({
          hasNextMove: true,
          hasCompletedFocusSession: true,
          hasVersion: true,
          hasGuestLinkOrCollaborator: true,
          hasFeedback: true,
          hasUnresolvedFeedback: false,
        }),
      ],
    });
    expect(j.recommendedStep).toBe("loop_complete");
    expect(j.state).toBe("complete");
    expect(j.completedSteps).toEqual([
      "track_exists",
      "next_move_set",
      "focus_session_completed",
      "bounce_uploaded",
      "feedback_loop_completed",
    ]);
  });
});

describe("deriveActivationJourney — track selection", () => {
  it("prefers a blocked/waiting track with unresolved feedback first", () => {
    const normal = track({ id: "normal", updatedAt: "2026-08-05T00:00:00Z" });
    const blocked = track({
      id: "blocked",
      updatedAt: "2026-08-01T00:00:00Z",
      isBlockedOrWaiting: true,
      hasNextMove: true,
      hasCompletedFocusSession: true,
      hasVersion: true,
      hasGuestLinkOrCollaborator: true,
      hasFeedback: true,
      hasUnresolvedFeedback: true,
    });
    const j = deriveActivationJourney({ tracks: [normal, blocked] });
    expect(j.targetTrackId).toBe("blocked");
    expect(j.recommendedStep).toBe("close_the_loop");
  });

  it("never recommends work on a released track", () => {
    const released = track({
      id: "released",
      title: "Take What You Want",
      isReleased: true,
      updatedAt: "2026-08-10T00:00:00Z",
    });
    const active = track({
      id: "active",
      title: "Things You Love the Most",
      updatedAt: "2026-08-05T00:00:00Z",
    });
    const j = deriveActivationJourney({ tracks: [released, active] });
    expect(j.targetTrackId).toBe("active");
    expect(j.targetTrackTitle).toBe("Things You Love the Most");
  });

  it("does not manufacture next moves when the whole catalog is released", () => {
    const j = deriveActivationJourney({
      tracks: [track({ isReleased: true, title: "Take What You Want" })],
    });
    expect(j.recommendedStep).toBe("loop_complete");
    expect(j.targetTrackId).toBeNull();
  });

  it("falls back to nearest next-action due date", () => {
    const later = track({ id: "later", nextMoveDueAt: "2026-09-01", hasNextMove: true });
    const sooner = track({ id: "sooner", nextMoveDueAt: "2026-08-10", hasNextMove: true });
    const j = deriveActivationJourney({ tracks: [later, sooner] });
    expect(j.targetTrackId).toBe("sooner");
  });

  it("falls back to most recently updated when no due dates exist", () => {
    const older = track({ id: "older", updatedAt: "2026-08-01T00:00:00Z" });
    const newer = track({ id: "newer", updatedAt: "2026-08-05T00:00:00Z" });
    const j = deriveActivationJourney({ tracks: [older, newer] });
    expect(j.targetTrackId).toBe("newer");
  });
});

describe("deriveActivationJourney — robustness", () => {
  it("carries through warnings from partial source failures", () => {
    const j = deriveActivationJourney({ tracks: [track()], warnings: ["sessions query failed"] });
    expect(j.warnings).toEqual(["sessions query failed"]);
  });

  it("is a pure function — same input always yields the same output", () => {
    const facts = { tracks: [track({ hasNextMove: true })] };
    const a = deriveActivationJourney(facts);
    const b = deriveActivationJourney(facts);
    expect(a).toEqual(b);
  });

  it("never marks a step complete from only one track when outcomes are split across two", () => {
    // Track A has a next move but nothing else; Track B has a bounce but no
    // next move. Recommended step must still be actionable, not "complete".
    const a = track({ id: "a", hasNextMove: true });
    const b = track({ id: "b", hasVersion: true });
    const j = deriveActivationJourney({ tracks: [a, b] });
    expect(j.recommendedStep).not.toBe("loop_complete");
    expect(j.completedSteps).toContain("next_move_set");
    expect(j.completedSteps).toContain("bounce_uploaded");
  });

  it("definitionVersion is present and stable", () => {
    const j = deriveActivationJourney({ tracks: [] });
    expect(j.definitionVersion).toBe(1);
  });
});
