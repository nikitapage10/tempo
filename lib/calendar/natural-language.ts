import { addDateKey, parseDateKey } from "@/lib/calendar/date";
import type { CalendarEventKind } from "@/lib/calendar/types";

export type ParsedSchedule = {
  date: string;
  time: string | null;
  kind: CalendarEventKind;
  title: string;
  task: boolean;
};

/**
 * "Studio session Friday at 7pm" → date/time/kind/title. A leading "task:"
 * prefix creates a task instead of an event — documented in the day panel's
 * placeholder since it has no other UI.
 */
export function parseNaturalSchedule(value: string, today: string): ParsedSchedule {
  const lower = value.toLowerCase();
  let date = today;
  if (lower.includes("tomorrow")) date = addDateKey(today, 1);
  else {
    const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const match = weekdays.findIndex((day) => lower.includes(day));
    if (match >= 0) {
      const current = parseDateKey(today).getDay();
      date = addDateKey(today, ((match - current + 7) % 7) || 7);
    }
  }
  const timeMatch = lower.match(/(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  let time: string | null = null;
  if (timeMatch) {
    let hour = Number(timeMatch[1]) % 12;
    if (timeMatch[3] === "pm") hour += 12;
    time = `${String(hour).padStart(2, "0")}:${timeMatch[2] ?? "00"}`;
  }
  const kind = lower.includes("studio")
    ? "studio_session"
    : lower.includes("meeting")
      ? "meeting"
      : lower.includes("content")
        ? "content"
        : lower.includes("show") || lower.includes("live")
          ? "live_show"
          : lower.includes("milestone")
            ? "milestone"
            : "other";
  const title = value
    .replace(/\b(today|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, "")
    .replace(/(?:at\s*)?\d{1,2}(?::\d{2})?\s*(?:am|pm)/gi, "")
    .replace(/^\s*(event|task)\s*:\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { date, time, kind, title: title || "Scheduled work", task: /^\s*task\s*:/i.test(value) };
}
