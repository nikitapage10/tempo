/**
 * First-workspace tour state.
 *
 * The pending flag is session-scoped because it bridges the Origin -> app
 * navigation. Completion is durable so the tour never becomes a recurring
 * interruption after the artist has taken or skipped it once.
 */
export const GUIDED_TOUR_PENDING_KEY = "tempo.guidedTour.pending";
export const GUIDED_TOUR_COMPLETE_KEY = "tempo.guidedTour.complete.v1";
export const ORIGIN_ARRIVAL_COMPLETE_EVENT = "tempo:origin-arrival-complete";

export function armGuidedTour() {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(GUIDED_TOUR_COMPLETE_KEY) === "1") return;
    sessionStorage.setItem(GUIDED_TOUR_PENDING_KEY, "1");
  } catch {
    /* Private mode: the workspace remains usable without the tour. */
  }
}

export function guidedTourIsPending(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      sessionStorage.getItem(GUIDED_TOUR_PENDING_KEY) === "1" &&
      localStorage.getItem(GUIDED_TOUR_COMPLETE_KEY) !== "1"
    );
  } catch {
    return false;
  }
}

export function completeGuidedTour() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GUIDED_TOUR_COMPLETE_KEY, "1");
    sessionStorage.removeItem(GUIDED_TOUR_PENDING_KEY);
  } catch {
    /* A failed preference write should never trap the artist in the tour. */
  }
}
