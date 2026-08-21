import { describe, expect, it } from "vitest";
import {
  checklistRollupByTrack,
  pickNextUp,
  projectProgressPct,
  sortTrackHealthRows,
} from "@/lib/projects/health";
import type { ChecklistItem, Task, Track } from "@/lib/types";

function task(partial: Partial<Task> & Pick<Task, "id" | "title">): Task {
  return {
    user_id: "u",
    space_id: "s",
    project_id: "p",
    track_id: null,
    category: "general",
    status: "todo",
    due_date: null,
    notes: null,
    priority: "none",
    reminder_minutes: [],
    recurrence: null,
    recurrence_until: null,
    recurrence_parent_id: null,
    completed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...partial,
  } as Task;
}

function track(partial: Partial<Track> & Pick<Track, "id" | "title">): Track {
  return {
    user_id: "u",
    space_id: "s",
    stage_id: null,
    project_id: "p",
    artist_alias: null,
    type: "original",
    bpm: null,
    musical_key: null,
    genre: null,
    destination: null,
    deadline: null,
    momentum: "steady",
    tags: [],
    notes: null,
    artwork_url: null,
    spotify_track_id: null,
    spotify_url: null,
    spotify_album_id: null,
    spotify_album_name: null,
    spotify_album_url: null,
    spotify_release_date: null,
    spotify_release_date_precision: null,
    spotify_isrc: null,
    spotify_duration_ms: null,
    spotify_explicit: null,
    spotify_track_number: null,
    spotify_disc_number: null,
    spotify_artist_names: [],
    spotify_synced_at: null,
    next_action: null,
    next_action_due: null,
    blocked_reason: null,
    waiting_on: null,
    stage_entered_at: "2026-01-01T00:00:00Z",
    list_sort: 0,
    list_group_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...partial,
  } as Track;
}

describe("project health helpers", () => {
  it("weights progress by tasks and checklist items without diluting empty tracks", () => {
    const rollup = checklistRollupByTrack([
      { track_id: "a", done: true } as ChecklistItem,
      { track_id: "a", done: false } as ChecklistItem,
      { track_id: "b", done: true } as ChecklistItem,
    ]);
    const pct = projectProgressPct(
      [
        task({ id: "t1", title: "A", status: "done" }),
        task({ id: "t2", title: "B", status: "todo" }),
      ],
      rollup,
      ["a", "b", "c"]
    );
    // done: 1 task + 2 checklist = 3; total: 2 tasks + 3 checklist = 5 → 60%
    expect(pct).toBe(60);
  });

  it("picks the soonest next-up across milestones, tasks, and track next actions", () => {
    const next = pickNextUp(
      [{ key: "deadline", date: "2026-09-01", label: "Deadline", tone: "amber" }],
      [task({ id: "1", title: "Mix", due_date: "2026-08-25", status: "todo" })],
      [
        track({
          id: "tr",
          title: "Song",
          next_action: "Comp vocals",
          next_action_due: "2026-08-22",
        }),
      ],
      "2026-08-21"
    );
    expect(next?.kind).toBe("track");
    expect(next?.label).toContain("Comp vocals");
  });

  it("sorts track health with overdue next actions first", () => {
    const rows = sortTrackHealthRows(
      [
        track({ id: "1", title: "Zed", next_action_due: "2026-08-25" }),
        track({ id: "2", title: "Alpha", next_action_due: "2026-08-10" }),
        track({ id: "3", title: "Beta" }),
      ],
      new Map(),
      "2026-08-21"
    );
    expect(rows.map((r) => r.track.id)).toEqual(["2", "1", "3"]);
  });
});
