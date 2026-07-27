import type { ChecklistItem, Task, TaskCategory } from "@/lib/types";

export type ReleasePlanChecklistSuggestion = {
  kind: "checklist";
  trackId: string;
  trackTitle: string;
  text: string;
};

export type ReleasePlanTaskSuggestion = {
  kind: "task";
  title: string;
  category: TaskCategory;
  dueOffsetDays?: number; // relative to release date, negative = before
};

export type ReleasePlanSuggestion =
  | ReleasePlanChecklistSuggestion
  | ReleasePlanTaskSuggestion;

/** Standard release-plan starter set (FEATURE-SPECS §12) — metadata, artwork, distribution, pitching, social, DJ, follow-up. */
export function buildReleasePlanSuggestions(
  tracks: { id: string; title: string }[]
): ReleasePlanSuggestion[] {
  const suggestions: ReleasePlanSuggestion[] = [];

  for (const track of tracks) {
    suggestions.push(
      { kind: "checklist", trackId: track.id, trackTitle: track.title, text: "Metadata filled in (artist, ISRC, credits)" },
      { kind: "checklist", trackId: track.id, trackTitle: track.title, text: "Artwork finalized (3000×3000+)" },
      { kind: "checklist", trackId: track.id, trackTitle: track.title, text: "Master approved and pinned" }
    );
  }

  suggestions.push(
    { kind: "task", title: "Submit to distributor", category: "admin", dueOffsetDays: -21 },
    { kind: "task", title: "Confirm pre-save link is live", category: "admin", dueOffsetDays: -7 },
    { kind: "task", title: "Build pitch list (playlists / blogs)", category: "pitching", dueOffsetDays: -28 },
    { kind: "task", title: "Send playlist pitches", category: "pitching", dueOffsetDays: -21 },
    { kind: "task", title: "Write release announcement copy", category: "social", dueOffsetDays: -7 },
    { kind: "task", title: "Schedule release-day social posts", category: "social", dueOffsetDays: -2 },
    { kind: "task", title: "Send promo to DJs", category: "outreach", dueOffsetDays: -14 },
    { kind: "task", title: "Follow up with playlist/blog contacts", category: "pitching", dueOffsetDays: 3 },
    { kind: "task", title: "Post release week recap", category: "social", dueOffsetDays: 7 }
  );

  return suggestions;
}

/** Filters out suggestions that already exist (by trimmed lowercase text/title match) so re-running the plan never duplicates. */
export function dedupeReleasePlanSuggestions(
  suggestions: ReleasePlanSuggestion[],
  existingChecklistByTrack: Map<string, ChecklistItem[]>,
  existingTasks: Task[]
): ReleasePlanSuggestion[] {
  return suggestions.filter((s) => {
    if (s.kind === "checklist") {
      const existing = existingChecklistByTrack.get(s.trackId) ?? [];
      return !existing.some(
        (c) => c.text.trim().toLowerCase() === s.text.trim().toLowerCase()
      );
    }
    return !existingTasks.some(
      (t) => t.title.trim().toLowerCase() === s.title.trim().toLowerCase()
    );
  });
}

export function dueDateFromOffset(
  releaseDate: string | null,
  offsetDays: number | undefined
): string | null {
  if (!releaseDate || offsetDays == null) return null;
  const d = new Date(`${releaseDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
