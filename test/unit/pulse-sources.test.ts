import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildAttentionItems,
  buildCalendarItems,
  buildDueItems,
  buildNotificationItems,
  buildProgressItems,
  filterItemsByPreferences,
  pulseCategoryForNotification,
  type PulseCategoryPreferences,
  type PulseTask,
  type PulseTrack,
} from "@/lib/pulse/sources";
import { labelForEmail } from "@/lib/pulse/normalize";
import type { AppNotification } from "@/lib/types";

const NOW = new Date("2026-09-18T15:00:00Z");

const allOn: PulseCategoryPreferences = {
  category_due: true,
  category_attention: true,
  category_feedback: true,
  category_collaboration: true,
  category_messages: true,
  category_calendar: true,
  category_progress: true,
};

function task(overrides: Partial<PulseTask> = {}): PulseTask {
  return { id: "t1", title: "Send the masters", due_date: "2026-09-18", status: "todo", ...overrides };
}

function track(overrides: Partial<PulseTrack> = {}): PulseTrack {
  return {
    id: "tr1",
    title: "White Devil",
    momentum: "active",
    deadline: null,
    next_action: "Mix pass",
    next_action_due: null,
    blocked_reason: null,
    waiting_on: null,
    stage_entered_at: NOW.toISOString(),
    ...overrides,
  };
}

function notification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: "n1",
    user_id: "u1",
    track_id: null,
    type: "dm_message",
    title: "New message",
    body: null,
    read_at: null,
    created_at: "2026-09-18T09:00:00Z",
    actor_profile_id: null,
    target_profile_id: null,
    entity_type: "conversation",
    entity_id: "c1",
    link_url: null,
    group_key: null,
    ...overrides,
  };
}

describe("due tasks", () => {
  it("separates overdue from due today from coming up", () => {
    const items = buildDueItems(
      [
        task({ id: "a", due_date: "2026-09-15" }),
        task({ id: "b", due_date: "2026-09-18" }),
        task({ id: "c", due_date: "2026-09-20" }),
      ],
      NOW,
      "UTC",
      7
    );
    expect(items.map((item) => item.reasonCode)).toEqual([
      "tasks_overdue",
      "tasks_due_today",
      "tasks_due_soon",
    ]);
    // Late work outranks everything else in the digest.
    expect(items[0].urgency).toBe("critical");
    expect(items[0].genericLabel).toBe("1 task is overdue");
  });

  it("ignores finished work and work with no date on it", () => {
    const items = buildDueItems(
      [task({ id: "a", status: "done" }), task({ id: "b", due_date: null })],
      NOW,
      "UTC",
      7
    );
    expect(items).toEqual([]);
  });

  it("decides 'today' in the member's timezone, not the server's", () => {
    // 15:00 UTC on the 18th is already the 19th in Auckland, so a task dated
    // the 18th is late there while the server would still call it due today.
    const [item] = buildDueItems([task({ due_date: "2026-09-18" })], NOW, "Pacific/Auckland", 7);
    expect(item.reasonCode).toBe("tasks_overdue");
  });

  it("only names the work for members who asked for names", () => {
    const [item] = buildDueItems(
      [task({ id: "a", title: "Send the masters" }), task({ id: "b", title: "Clear the sample" })],
      NOW,
      "UTC",
      7
    );
    expect(labelForEmail(item, false)).toBe("2 tasks are due today");
    expect(labelForEmail(item, true)).toContain("Send the masters");
  });

  it("caps the names instead of listing a whole backlog", () => {
    const many = Array.from({ length: 9 }, (_, i) => task({ id: `t${i}`, title: `Task ${i}` }));
    const [item] = buildDueItems(many, NOW, "UTC", 7);
    expect(labelForEmail(item, true)).toContain("and 7 more");
  });

  it("keeps a daily digest to the next couple of days", () => {
    const soon = [task({ due_date: "2026-09-23" })];
    expect(buildDueItems(soon, NOW, "UTC", 2)).toEqual([]);
    expect(buildDueItems(soon, NOW, "UTC", 7)).toHaveLength(1);
  });
});

describe("tracks needing attention", () => {
  /** Worked on yesterday, so only a real problem can flag these. */
  const worked = (ids: string[]) =>
    new Map(ids.map((id) => [id, "2026-09-17T12:00:00Z"] as [string, string | null]));

  it("uses the same rules the catalog shows", () => {
    const items = buildAttentionItems(
      [track({ blocked_reason: "Waiting on the split sheet" }), track({ id: "tr2" })],
      worked(["tr1", "tr2"]),
      NOW
    );
    expect(items).toHaveLength(1);
    expect(items[0].genericLabel).toBe("1 track needs attention");
    expect(labelForEmail(items[0], true)).toContain("White Devil");
  });

  it("says nothing when nothing is flagged", () => {
    expect(buildAttentionItems([track()], worked(["tr1"]), NOW)).toEqual([]);
  });

  it("does not call the whole catalog stale just because it has no session data", () => {
    // A missing session date means "never logged" to the attention rules. If
    // the digest skipped that lookup, every active track would be flagged
    // every day and the line would stop meaning anything — so a track with a
    // recent session must stay quiet while a genuinely dormant one shows up.
    const quiet = buildAttentionItems([track()], worked(["tr1"]), NOW);
    const dormant = buildAttentionItems([track()], new Map([["tr1", "2026-08-01T12:00:00Z"]]), NOW);
    expect(quiet).toEqual([]);
    expect(dormant).toHaveLength(1);
  });
});

describe("calendar", () => {
  const event = (id: string, starts_at: string) => ({ id, title: `Show ${id}`, starts_at, start_date: null });

  it("counts what is inside the window and drops the rest", () => {
    const items = buildCalendarItems(
      [event("a", "2026-09-19T18:00:00Z"), event("b", "2026-11-01T18:00:00Z")],
      NOW,
      7
    );
    expect(items[0].count).toBe(1);
  });

  it("marks something in the next day as today rather than soon", () => {
    const [near] = buildCalendarItems([event("a", "2026-09-18T20:00:00Z")], NOW, 7);
    const [far] = buildCalendarItems([event("b", "2026-09-23T20:00:00Z")], NOW, 7);
    expect(near.urgency).toBe("today");
    expect(far.urgency).toBe("soon");
  });

  it("handles all-day events, which carry a date and no timestamp", () => {
    const items = buildCalendarItems(
      [{ id: "a", title: "Release day", starts_at: null, start_date: "2026-09-20" }],
      NOW,
      7
    );
    expect(items).toHaveLength(1);
  });
});

describe("unread notifications", () => {
  it("sorts each kind into the part of the digest it belongs to", () => {
    expect(pulseCategoryForNotification(notification({ type: "dm_message" }))).toBe("messages");
    expect(pulseCategoryForNotification(notification({ type: "comment_reply" }))).toBe("feedback");
    expect(pulseCategoryForNotification(notification({ type: "new_version" }))).toBe("collaboration");
    expect(pulseCategoryForNotification(notification({ type: "team_invite" }))).toBe("collaboration");
    expect(
      pulseCategoryForNotification(notification({ type: "calendar_reminder", entity_type: "calendar_event" }))
    ).toBe("calendar");
    // Support arrives in the same inbox as messages, so it reads as one count.
    expect(pulseCategoryForNotification(notification({ type: "support_reply" }))).toBe("messages");
    // Anything unrecognized is left out rather than filed somewhere wrong.
    expect(pulseCategoryForNotification(notification({ type: "profile_follow", entity_type: "profile" }))).toBeNull();
  });

  it("counts unread only, and never quotes what they say", () => {
    const items = buildNotificationItems([
      notification({ id: "a" }),
      notification({ id: "b" }),
      notification({ id: "c", read_at: "2026-09-18T10:00:00Z" }),
      notification({ id: "d", type: "comment_reply", entity_type: null, title: "Ellis said: this mix is muddy" }),
    ]);
    const messages = items.find((item) => item.category === "messages");
    expect(messages?.count).toBe(2);
    expect(messages?.genericLabel).toBe("2 new messages");
    // The body of a message is never safe to put in an email.
    expect(messages?.sensitivity).toBe("never_email");
    const feedback = items.find((item) => item.category === "feedback");
    expect(labelForEmail(feedback!, true)).toBe("1 new comment on your work");
    for (const item of items) {
      expect(JSON.stringify(item)).not.toContain("muddy");
    }
  });
});

describe("weekly progress", () => {
  it("reports only what actually happened", () => {
    const [item] = buildProgressItems({ tasksCompleted: 4, versionsUploaded: 1, sessionsLogged: 0 }, NOW);
    expect(item.genericLabel).toBe("This week: 4 tasks finished and 1 new bounce");
  });

  it("stays quiet on a week with nothing in it", () => {
    expect(buildProgressItems({ tasksCompleted: 0, versionsUploaded: 0, sessionsLogged: 0 }, NOW)).toEqual([]);
  });
});

describe("category preferences", () => {
  const items = [
    ...buildDueItems([task()], NOW, "UTC", 7),
    ...buildAttentionItems(
      [track({ blocked_reason: "Stuck" })],
      new Map([["tr1", "2026-09-17T12:00:00Z"]]),
      NOW
    ),
    ...buildNotificationItems([notification()]),
    ...buildProgressItems({ tasksCompleted: 2, versionsUploaded: 0, sessionsLogged: 0 }, NOW),
  ];

  it("drops a category the member switched off", () => {
    const filtered = filterItemsByPreferences(
      items,
      { ...allOn, category_due: false },
      "weekly_digest"
    );
    expect(filtered.some((item) => item.category === "due")).toBe(false);
    expect(filtered.some((item) => item.category === "attention")).toBe(true);
  });

  it("keeps the weekly look back out of a daily digest", () => {
    expect(filterItemsByPreferences(items, allOn, "daily_digest").some((i) => i.category === "progress")).toBe(false);
    expect(filterItemsByPreferences(items, allOn, "weekly_digest").some((i) => i.category === "progress")).toBe(true);
  });

  it("can empty the digest entirely, which means nothing is sent", () => {
    const off = Object.fromEntries(
      Object.keys(allOn).map((key) => [key, false])
    ) as PulseCategoryPreferences;
    expect(filterItemsByPreferences(items, off, "weekly_digest")).toEqual([]);
  });
});

describe("what the digest is allowed to read", () => {
  const server = readFileSync(resolve("lib/pulse/aggregate-server.ts"), "utf8");

  it("scopes to workspaces the member owns, not ones merely shared with them", () => {
    // The service-role client ignores row-level security, so scoping is this
    // file's job alone. A workspace shared as a team member is excluded: its
    // owner already receives that digest.
    expect(server).toContain('.from("artists")');
    expect(server).toContain('.eq("user_id", userId)');
    expect(server).toContain('.in("artist_id", artistIds)');
    for (const table of ["tasks", "tracks", "calendar_events"]) {
      expect(server, `${table} must be scoped by space`).toMatch(
        new RegExp(`from\\("${table}"\\)[\\s\\S]{0,400}?in\\("space_id", spaceIds\\)|assigned_to_user_id`)
      );
    }
  });

  it("never emails anyone about the demo artist's work", () => {
    expect(server).toContain('.is("demo_kind", null)');
  });

  it("reads only this member's notifications", () => {
    expect(server).toMatch(/from\("notifications"\)[\s\S]{0,300}eq\("user_id", userId\)/);
  });
});

describe("the settings screen now controls something", () => {
  it("every category switch is wired to a category of item", () => {
    const sources = readFileSync(resolve("lib/pulse/sources.ts"), "utf8");
    const panel = readFileSync(resolve("components/settings/pulse-preferences-panel.tsx"), "utf8");
    const offered = Array.from(panel.matchAll(/key: "(category_[a-z]+)"/g)).map((m) => m[1]);
    expect(offered.length).toBe(7);
    for (const key of offered) {
      expect(sources, `${key} is offered in Settings but nothing reads it`).toContain(`"${key}"`);
    }
  });
});
