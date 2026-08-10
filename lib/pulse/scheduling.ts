/**
 * Pure scheduling and retry logic for Pulse email —
 * 02-TECHNICAL-AND-DATA-DESIGN.md §6.2, §7. No wall-clock reads inside
 * these functions; every "now" is passed in, so tests are deterministic
 * and DST/timezone edge cases are fully covered without mocking Date.
 */

export type DigestFrequency = "off" | "daily" | "weekly";

export type CadenceInput = {
  frequency: DigestFrequency;
  /** IANA timezone, e.g. "America/Denver". */
  timezone: string;
  /** "HH:MM" 24h local time. */
  localTime: string;
  /** ISO weekday 1-7 (Mon-Sun), required when frequency is "weekly". */
  weeklyDay: number | null;
  pausedUntil: string | null; // local date "YYYY-MM-DD"
  lastWindowEnd: string | null; // ISO instant
};

/** Formats a UTC instant's local wall-clock parts in the given IANA timezone. */
function localParts(instant: Date, timezone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const parts = Object.fromEntries(fmt.formatToParts(instant).map((p) => [p.type, p.value]));
  const weekdayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hhmm: `${parts.hour}:${parts.minute}`,
    isoWeekday: weekdayMap[parts.weekday],
  };
}

/**
 * True if a digest is due to be evaluated now. Fires once local wall-clock
 * time reaches or passes the configured delivery time on/after the window
 * boundary — dedupe (via a stable window-derived key) is what prevents a
 * repeated local time (DST "fall back") from sending twice, not this check
 * refusing to fire; a DST "spring forward" gap simply means the next tick
 * after the gap is the first one that satisfies `hhmm >= localTime`.
 */
export function isDigestDue(cadence: CadenceInput, nowUtc: Date): boolean {
  if (cadence.frequency === "off") return false;

  const local = localParts(nowUtc, cadence.timezone);
  if (cadence.pausedUntil && local.date <= cadence.pausedUntil) return false;
  if (local.hhmm < cadence.localTime) return false;
  if (cadence.frequency === "weekly" && local.isoWeekday !== cadence.weeklyDay) return false;

  // Already evaluated today's (or this week's) window — the window key is
  // the local calendar date the digest belongs to; comparing against the
  // last recorded window prevents re-firing on every subsequent scheduler
  // tick within the same day.
  const windowKey = digestWindowKey(cadence.frequency, local.date);
  if (cadence.lastWindowEnd === windowKey) return false;

  return true;
}

/** Stable identity for "this digest's window" — used both for the due-check and the dedupe key. */
export function digestWindowKey(frequency: DigestFrequency, localDate: string): string {
  return `${frequency}:${localDate}`;
}

/** Stable per-user/kind/window dedupe key — safe to hash before provider use. */
export function deliveryDedupeKey(userId: string, kind: string, windowKey: string): string {
  return `${userId}:${kind}:${windowKey}`;
}

export type RetryDecision =
  | { action: "retry"; nextAttemptAt: string }
  | { action: "fail_terminal" };

const BACKOFF_MINUTES = [1, 5, 30, 120]; // then terminal on the 5th attempt
const MAX_ATTEMPTS = 5;

/** Exponential backoff with a fixed schedule — 02-TECHNICAL-AND-DATA-DESIGN.md §7. */
export function decideRetry(attemptCount: number, nowUtc: Date): RetryDecision {
  if (attemptCount >= MAX_ATTEMPTS) return { action: "fail_terminal" };
  const minutes = BACKOFF_MINUTES[Math.min(attemptCount, BACKOFF_MINUTES.length - 1)];
  return {
    action: "retry",
    nextAttemptAt: new Date(nowUtc.getTime() + minutes * 60_000).toISOString(),
  };
}

export type FailureClass = "transient" | "permanent";

/** Classifies a Resend/network failure — permanent failures never retry. */
export function classifyEmailFailure(errorMessage: string, httpStatus?: number): FailureClass {
  if (httpStatus && httpStatus >= 400 && httpStatus < 500 && httpStatus !== 429) return "permanent";
  const hasInvalidAddress =
    /invalid/i.test(errorMessage) && /(email|address)/i.test(errorMessage);
  if (hasInvalidAddress || /malformed/i.test(errorMessage)) return "permanent";
  return "transient";
}

/** True if a lease has expired and the row should return to retry. */
export function isClaimExpired(claimExpiresAt: string | null, nowUtc: Date): boolean {
  if (!claimExpiresAt) return false;
  return new Date(claimExpiresAt).getTime() <= nowUtc.getTime();
}
