import { deriveAttentionSignals } from "@/lib/attention/signals";
import { notificationBreadth } from "@/lib/notifications/href";
import type { AppNotification, Task, Track } from "@/lib/types";
import type { PulseCategory, RawPulseItem } from "./normalize";

/**
 * Turns rows the member can already see into Pulse items.
 *
 * Every function here is pure: rows in, items out, clock passed explicitly.
 * Fetching and — far more importantly — deciding whose rows may be read
 * happens in aggregate-server.ts, which runs with a service-role client that
 * ignores row-level security. Keeping the two apart means the rules about
 * what a digest *says* can be tested exhaustively without a database, and the
 * rules about what it may *see* live in one short, reviewable place.
 *
 * Labels are counts and names, never content. No message body, comment text,
 * or file URL is ever allowed into an item — an email is not a private
 * surface, and `sensitivity` decides whether even a name may appear.
 */

export type PulseDigestKind = "daily_digest" | "weekly_digest";

/** The subset of notification_preferences that changes what a digest contains. */
export type PulseCategoryPreferences = {
  category_due: boolean;
  category_attention: boolean;
  category_feedback: boolean;
  category_collaboration: boolean;
  category_messages: boolean;
  category_calendar: boolean;
  category_progress: boolean;
};

export type PulseTask = Pick<Task, "id" | "title" | "due_date" | "status">;
export type PulseTrack = Pick<
  Track,
  | "id"
  | "title"
  | "momentum"
  | "deadline"
  | "next_action"
  | "next_action_due"
  | "blocked_reason"
  | "waiting_on"
  | "stage_entered_at"
>;
export type PulseEvent = {
  id: string;
  title: string;
  starts_at: string | null;
  start_date: string | null;
};
export type PulseProgress = {
  tasksCompleted: number;
  versionsUploaded: number;
  sessionsLogged: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local calendar day, so "due today" means today where the member is. */
function dayKey(value: string | Date, timezone: string): string {
  const date = typeof value === "string" ? parseLoose(value) : value;
  if (!date) return "";
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(date);
  }
}

/** Dates arrive as either `2026-09-18` or a full timestamp. */
function parseLoose(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many.replace("{n}", String(count));
}

/**
 * "Bandcamp page, Master notes, and 3 more" — names only, and only for
 * members who asked for them. Capped so a long list cannot turn a subject
 * line into a wall.
 */
function nameList(titles: string[], limit = 2): string {
  const named = titles.filter((title) => title.trim()).slice(0, limit);
  if (!named.length) return "";
  const rest = titles.length - named.length;
  if (rest > 0) return `${named.join(", ")}, and ${rest} more`;
  if (named.length === 1) return named[0];
  return `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}`;
}

/**
 * Tasks with a date on them, split by how late they are. Overdue is its own
 * item rather than a bigger number on the same line: "3 tasks due" reads as
 * planning, "3 tasks overdue" reads as a problem, and they are not the same
 * message.
 */
export function buildDueItems(
  tasks: PulseTask[],
  now: Date,
  timezone: string,
  horizonDays: number
): RawPulseItem[] {
  const today = dayKey(now, timezone);
  const horizon = dayKey(new Date(now.getTime() + horizonDays * DAY_MS), timezone);

  // A due date is a calendar date, not an instant: "due the 18th" means the
  // 18th wherever you are. Only the clock gets converted, so a member in
  // Auckland is told something is late on their 19th, not on the server's.
  const dueOn = (task: PulseTask) => task.due_date!.slice(0, 10);

  const open = tasks.filter((task) => task.status !== "done" && task.due_date);
  const overdue = open.filter((task) => dueOn(task) < today);
  const dueToday = open.filter((task) => dueOn(task) === today);
  const dueSoon = open.filter((task) => dueOn(task) > today && dueOn(task) <= horizon);

  const items: RawPulseItem[] = [];
  const add = (
    group: PulseTask[],
    urgency: RawPulseItem["urgency"],
    dedupe: string,
    reasonCode: string,
    one: string,
    many: string
  ) => {
    if (!group.length) return;
    const earliest = group
      .map((task) => task.due_date!)
      .sort((a, b) => a.localeCompare(b))[0];
    items.push({
      dedupeIdentity: dedupe,
      category: "due",
      urgency,
      dueAt: earliest,
      genericLabel: plural(group.length, one, many),
      namedLabel: `${plural(group.length, one, many)}: ${nameList(group.map((t) => t.title))}`,
      count: group.length,
      reasonCode,
      destination: "/tasks",
      sensitivity: "entity_name",
    });
  };

  add(overdue, "critical", "pulse:tasks-overdue", "tasks_overdue", "1 task is overdue", "{n} tasks are overdue");
  add(dueToday, "today", "pulse:tasks-due-today", "tasks_due_today", "1 task is due today", "{n} tasks are due today");
  add(dueSoon, "soon", "pulse:tasks-due-soon", "tasks_due_soon", "1 task is coming up", "{n} tasks are coming up");
  return items;
}

/**
 * Tracks the catalog already flags as needing attention — blocked, waiting on
 * someone, a deadline closing in. Reuses the same rules the app shows, so a
 * digest can never disagree with the screen it is summarizing.
 */
export function buildAttentionItems(
  tracks: PulseTrack[],
  lastSessionByTrackId: Map<string, string | null>,
  now: Date
): RawPulseItem[] {
  // The "gone quiet" signal treats a missing session date as never worked on,
  // so leaving it out would flag the entire catalog every single day and make
  // the whole line meaningless.
  const flagged = tracks.filter(
    (track) =>
      deriveAttentionSignals(
        { track, lastSessionAt: lastSessionByTrackId.get(track.id) ?? null },
        now
      ).length > 0
  );
  if (!flagged.length) return [];
  return [
    {
      dedupeIdentity: "pulse:tracks-attention",
      category: "attention",
      urgency: "today",
      occurredAt: now.toISOString(),
      genericLabel: plural(flagged.length, "1 track needs attention", "{n} tracks need attention"),
      namedLabel: `${plural(flagged.length, "1 track needs attention", "{n} tracks need attention")}: ${nameList(flagged.map((track) => track.title))}`,
      count: flagged.length,
      reasonCode: "tracks_need_attention",
      destination: "/tracks",
      sensitivity: "entity_name",
    },
  ];
}

/** What is actually on the calendar between now and the end of the window. */
export function buildCalendarItems(
  events: PulseEvent[],
  now: Date,
  horizonDays: number
): RawPulseItem[] {
  const horizon = new Date(now.getTime() + horizonDays * DAY_MS);
  const startOfToday = new Date(now.getTime() - DAY_MS);
  const upcoming = events
    .map((event) => ({ event, at: parseLoose(event.starts_at ?? event.start_date) }))
    .filter((row): row is { event: PulseEvent; at: Date } => Boolean(row.at))
    .filter((row) => row.at >= startOfToday && row.at <= horizon)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  if (!upcoming.length) return [];

  const withinDay = upcoming[0].at.getTime() - now.getTime() <= DAY_MS;
  return [
    {
      dedupeIdentity: "pulse:calendar-upcoming",
      category: "calendar",
      urgency: withinDay ? "today" : "soon",
      dueAt: upcoming[0].at.toISOString(),
      genericLabel: plural(upcoming.length, "1 thing on the calendar", "{n} things on the calendar"),
      namedLabel: `${plural(upcoming.length, "1 thing on the calendar", "{n} things on the calendar")}: ${nameList(upcoming.map((row) => row.event.title))}`,
      count: upcoming.length,
      reasonCode: "calendar_upcoming",
      destination: "/calendar",
      sensitivity: "entity_name",
    },
  ];
}

const FEEDBACK_TYPES = new Set(["comment_reply", "comment_assigned", "decision_requested"]);
const COLLABORATION_TYPES = new Set([
  "new_version",
  "invite_accepted",
  "team_invite",
  "team_invite_accepted",
  "team_invite_declined",
  "team_join_request",
  "team_join_request_declined",
]);

/**
 * Which part of a digest an unread notification belongs to.
 *
 * Anything unrecognized is left out rather than swept into a category it
 * might not belong to. A digest that quietly miscategorizes is worse than one
 * that is briefly incomplete.
 */
export function pulseCategoryForNotification(
  notification: AppNotification
): PulseCategory | null {
  const type = notification.type ?? "";
  if (FEEDBACK_TYPES.has(type)) return "feedback";
  if (COLLABORATION_TYPES.has(type) || notification.entity_type === "artist_member") {
    return "collaboration";
  }
  const breadth = notificationBreadth(notification);
  // Support lives in the same inbox as messages, so it reads as one count.
  if (breadth === "messages" || breadth === "support") return "messages";
  if (breadth === "calendar") return "calendar";
  return null;
}

const NOTIFICATION_LABELS: Record<string, { one: string; many: string; destination: string; reason: string }> = {
  messages: { one: "1 new message", many: "{n} new messages", destination: "/messages", reason: "unread_messages" },
  feedback: { one: "1 new comment on your work", many: "{n} new comments on your work", destination: "/", reason: "unread_feedback" },
  collaboration: { one: "1 collaboration update", many: "{n} collaboration updates", destination: "/team", reason: "unread_collaboration" },
  calendar: { one: "1 calendar reminder", many: "{n} calendar reminders", destination: "/calendar", reason: "calendar_reminders" },
};

/**
 * Unread notifications, counted per category. Titles and bodies are dropped
 * on the way in: a notification title can quote a comment, and this is going
 * to an inbox that is not TEMPO.
 */
export function buildNotificationItems(notifications: AppNotification[]): RawPulseItem[] {
  const unread = notifications.filter((notification) => !notification.read_at);
  const grouped = new Map<PulseCategory, AppNotification[]>();
  for (const notification of unread) {
    const category = pulseCategoryForNotification(notification);
    if (!category) continue;
    const list = grouped.get(category) ?? [];
    list.push(notification);
    grouped.set(category, list);
  }

  const items: RawPulseItem[] = [];
  for (const [category, list] of Array.from(grouped.entries())) {
    const copy = NOTIFICATION_LABELS[category];
    if (!copy) continue;
    const newest = list
      .map((notification) => notification.created_at)
      .sort((a, b) => b.localeCompare(a))[0];
    items.push({
      dedupeIdentity: `pulse:unread-${category}`,
      category,
      urgency: "awareness",
      occurredAt: newest,
      genericLabel: plural(list.length, copy.one, copy.many),
      count: list.length,
      reasonCode: copy.reason,
      destination: copy.destination,
      // A count of unread items is safe to email; what they say is not, and
      // there is no named version of this line for that reason.
      sensitivity: "never_email",
    });
  }
  return items;
}

/** The weekly look back: what actually moved, rather than what is waiting. */
export function buildProgressItems(progress: PulseProgress, now: Date): RawPulseItem[] {
  const parts: string[] = [];
  if (progress.tasksCompleted) parts.push(plural(progress.tasksCompleted, "1 task finished", "{n} tasks finished"));
  if (progress.versionsUploaded) parts.push(plural(progress.versionsUploaded, "1 new bounce", "{n} new bounces"));
  if (progress.sessionsLogged) parts.push(plural(progress.sessionsLogged, "1 session logged", "{n} sessions logged"));
  if (!parts.length) return [];
  return [
    {
      dedupeIdentity: "pulse:weekly-progress",
      category: "progress",
      urgency: "awareness",
      occurredAt: now.toISOString(),
      genericLabel: `This week: ${nameList(parts, 3)}`,
      count: progress.tasksCompleted + progress.versionsUploaded + progress.sessionsLogged,
      reasonCode: "weekly_progress",
      destination: "/stats",
      sensitivity: "generic",
    },
  ];
}

const CATEGORY_PREFERENCE: Record<PulseCategory, keyof PulseCategoryPreferences | null> = {
  due: "category_due",
  attention: "category_attention",
  feedback: "category_feedback",
  collaboration: "category_collaboration",
  messages: "category_messages",
  calendar: "category_calendar",
  progress: "category_progress",
  // Product announcements are not a member-facing switch.
  product: null,
};

/**
 * Applies the switches on the notification settings screen. Every category
 * there now controls something; before this, all seven were saved and none
 * were read, so turning one off changed nothing.
 *
 * Progress is a weekly-only look back, as the settings screen says. In a
 * daily digest it would be the same line seven times.
 */
export function filterItemsByPreferences(
  items: RawPulseItem[],
  preferences: PulseCategoryPreferences,
  kind: PulseDigestKind
): RawPulseItem[] {
  return items.filter((item) => {
    if (item.category === "progress" && kind !== "weekly_digest") return false;
    const key = CATEGORY_PREFERENCE[item.category];
    if (!key) return true;
    return preferences[key] !== false;
  });
}
