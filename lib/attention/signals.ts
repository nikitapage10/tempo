import type { AttentionSignal, Momentum, Track } from "@/lib/types";

export type AttentionInput = {
  track: Pick<
    Track,
    | "id"
    | "momentum"
    | "deadline"
    | "next_action"
    | "next_action_due"
    | "blocked_reason"
    | "waiting_on"
    | "stage_entered_at"
  >;
  lastSessionAt?: string | null;
  unresolvedCommentCount?: number;
  needsDecision?: boolean;
};

function daysBetween(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(t.getTime())) return null;
  return (now.getTime() - t.getTime()) / (1000 * 60 * 60 * 24);
}

function daysUntil(dateStr: string | null | undefined, now: Date): number | null {
  if (!dateStr) return null;
  const t = new Date(`${dateStr}T23:59:59`);
  if (Number.isNaN(t.getTime())) return null;
  return (t.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
}

/** Pure, explainable attention signals — no opaque composite score. */
export function deriveAttentionSignals(
  input: AttentionInput,
  now = new Date()
): AttentionSignal[] {
  const { track } = input;
  const signals: AttentionSignal[] = [];

  if (track.blocked_reason?.trim()) {
    signals.push({
      id: "blocked",
      label: "Blocked",
      severity: "critical",
      explanation: `Blocked: ${track.blocked_reason.trim()}`,
    });
  }

  if (track.waiting_on?.trim()) {
    signals.push({
      id: "waiting",
      label: "Waiting",
      severity: "warn",
      explanation: `Waiting on ${track.waiting_on.trim()}`,
    });
  }

  if (!track.next_action?.trim() && track.momentum === "active") {
    signals.push({
      id: "no-next-move",
      label: "No next move",
      severity: "warn",
      explanation: "This track is active but has no next move set.",
    });
  }

  const nextDueIn = daysUntil(track.next_action_due, now);
  if (nextDueIn != null && nextDueIn < 0 && track.next_action?.trim()) {
    signals.push({
      id: "next-overdue",
      label: "Next move overdue",
      severity: "critical",
      explanation: `Next move was due ${Math.abs(Math.floor(nextDueIn))} day(s) ago.`,
    });
  }

  const deadlineIn = daysUntil(track.deadline, now);
  if (
    deadlineIn != null &&
    deadlineIn <= 7 &&
    track.momentum !== "parked"
  ) {
    signals.push({
      id: "deadline-approaching",
      label: deadlineIn < 0 ? "Deadline passed" : "Deadline soon",
      severity: deadlineIn < 0 ? "critical" : "warn",
      explanation:
        deadlineIn < 0
          ? `Track deadline passed ${Math.abs(Math.floor(deadlineIn))} day(s) ago.`
          : `Track deadline is in ${Math.ceil(deadlineIn)} day(s).`,
    });
  }

  const sessionAge = daysBetween(input.lastSessionAt ?? null, now);
  if (sessionAge == null || sessionAge >= 7) {
    if (track.momentum === "active" || track.momentum === "simmering") {
      signals.push({
        id: "inactive",
        label: "Quiet 7+ days",
        severity: "info",
        explanation:
          sessionAge == null
            ? "No sessions logged yet on this track."
            : `Last session was ${Math.floor(sessionAge)} day(s) ago.`,
      });
    }
  }

  const stageAge = daysBetween(track.stage_entered_at, now);
  if (stageAge != null && stageAge >= 14 && track.momentum !== "parked") {
    signals.push({
      id: "stage-stale",
      label: "Long in stage",
      severity: "info",
      explanation: `In the current stage for ${Math.floor(stageAge)} day(s).`,
    });
  }

  if ((input.unresolvedCommentCount ?? 0) > 0) {
    const n = input.unresolvedCommentCount!;
    signals.push({
      id: "unresolved-feedback",
      label: n === 1 ? "1 open comment" : `${n} open comments`,
      severity: "warn",
      explanation: `${n} unresolved comment(s) need attention.`,
    });
  }

  if (input.needsDecision) {
    signals.push({
      id: "approval-needed",
      label: "Decision needed",
      severity: "warn",
      explanation: "A version is waiting on an approval decision.",
    });
  }

  return signals;
}

export function signalPriority(signal: AttentionSignal): number {
  if (signal.severity === "critical") return 0;
  if (signal.severity === "warn") return 1;
  return 2;
}

export function sortTracksByAttention<T extends AttentionInput>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const sa = deriveAttentionSignals(a);
    const sb = deriveAttentionSignals(b);
    const pa = sa[0] ? signalPriority(sa[0]) : 9;
    const pb = sb[0] ? signalPriority(sb[0]) : 9;
    if (pa !== pb) return pa - pb;
    const da = a.track.next_action_due || a.track.deadline || "9999";
    const db = b.track.next_action_due || b.track.deadline || "9999";
    return da.localeCompare(db);
  });
}

export function momentumStillArtistIntent(_m: Momentum): true {
  return true;
}
