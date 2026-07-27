export type NotifyInput = {
  trackId: string;
  type: string;
  title: string;
  body?: string | null;
  /** Notify just this person instead of everyone on the track. */
  targetUserId?: string | null;
};

/**
 * Best-effort cross-user notification via /api/notify (service role) —
 * never throws, since a missed notification shouldn't block the action
 * that triggered it (upload, comment, etc).
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    /* best-effort */
  }
}
