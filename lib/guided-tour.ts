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
/** Lives for the full handoff animation; unlike the pre-paint cover class. */
export const ORIGIN_ARRIVAL_RUNNING_CLASS = "origin-arrival-running";

type PendingTour = {
  artistId: string;
  force: boolean;
  legacy?: boolean;
};

function completionKey(artistId: string) {
  return `${GUIDED_TOUR_COMPLETE_KEY}:${artistId}`;
}

function readPendingTour(): PendingTour | null {
  const raw = sessionStorage.getItem(GUIDED_TOUR_PENDING_KEY);
  if (!raw) return null;
  // Keep a pending tour created by the original global implementation usable
  // across a hot update instead of silently losing it.
  if (raw === "1") return { artistId: "legacy", force: false, legacy: true };
  try {
    const parsed = JSON.parse(raw) as Partial<PendingTour>;
    if (typeof parsed.artistId !== "string") return null;
    return { artistId: parsed.artistId, force: parsed.force === true };
  } catch {
    return null;
  }
}

export function armGuidedTour(
  artistId: string | null,
  { force = false }: { force?: boolean } = {}
) {
  if (typeof window === "undefined") return;
  try {
    const scopedArtistId = artistId ?? "default";
    if (!force && localStorage.getItem(completionKey(scopedArtistId)) === "1") return;
    sessionStorage.setItem(
      GUIDED_TOUR_PENDING_KEY,
      JSON.stringify({ artistId: scopedArtistId, force })
    );
  } catch {
    /* Private mode: the workspace remains usable without the tour. */
  }
}

export function guidedTourIsPending(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const pending = readPendingTour();
    if (!pending) return false;
    if (pending.force) return true;
    const key = pending.legacy
      ? GUIDED_TOUR_COMPLETE_KEY
      : completionKey(pending.artistId);
    return localStorage.getItem(key) !== "1";
  } catch {
    return false;
  }
}

export function completeGuidedTour() {
  if (typeof window === "undefined") return;
  try {
    const pending = readPendingTour();
    if (pending) {
      const key = pending.legacy
        ? GUIDED_TOUR_COMPLETE_KEY
        : completionKey(pending.artistId);
      localStorage.setItem(key, "1");
    }
    sessionStorage.removeItem(GUIDED_TOUR_PENDING_KEY);
  } catch {
    /* A failed preference write should never trap the artist in the tour. */
  }
}
