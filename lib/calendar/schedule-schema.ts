import type { CalendarEventKind } from "@/lib/calendar/types";

/** Strict JSON schema for the calendar quick-add's responses.create call. */
export const SCHEDULE_PARSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["title", "date", "time", "kind", "isTask"],
  properties: {
    title: {
      type: "string",
      description: "A short, clean event or task title with the date/time/kind words removed.",
    },
    date: {
      type: "string",
      description: "The scheduled date as YYYY-MM-DD, resolved against the given 'today' date and weekday names.",
    },
    time: {
      type: ["string", "null"],
      description: "24-hour HH:MM local time if a specific time was said or written, otherwise null for an all-day item.",
    },
    kind: {
      type: "string",
      enum: ["studio_session", "meeting", "content", "live_show", "personal", "milestone", "other"],
      description: "Best-fit event category. Use 'other' if unclear.",
    },
    isTask: {
      type: "boolean",
      description: "True only if the artist is describing a to-do/task rather than a scheduled event — e.g. starts with 'task:', or is clearly a checklist item with no real appointment time.",
    },
  },
};

export type ScheduleParseResult = {
  title: string;
  date: string;
  time: string | null;
  kind: CalendarEventKind;
  isTask: boolean;
};
