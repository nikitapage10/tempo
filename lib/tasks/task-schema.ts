/** Strict JSON schema for the tasks quick-add's responses.create call. */
export const TASK_PARSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "category",
    "dueDate",
    "priority",
    "assigneeName",
    "projectName",
    "trackName",
    "steps",
    "recurrence",
    "reminderMinutes",
    "notes",
  ],
  properties: {
    title: {
      type: "string",
      description:
        "A short, clean task title with the date/priority/assignee/project words removed.",
    },
    category: {
      type: "string",
      description: "Best-fit category key from the given list. Use 'other' if unclear.",
    },
    dueDate: {
      type: ["string", "null"],
      description:
        "Due date as YYYY-MM-DD, resolved against the given 'today' date and weekday names, or null if no date was said.",
    },
    priority: {
      type: "integer",
      enum: [0, 1, 2, 3],
      description:
        "0 none, 1 low, 2 high, 3 urgent. Infer from words like 'urgent', 'asap', 'whenever', '!!!'. Default 0.",
    },
    assigneeName: {
      type: ["string", "null"],
      description: "Person's name if the task should be assigned to someone, otherwise null.",
    },
    projectName: {
      type: ["string", "null"],
      description: "Project name if one was mentioned or clearly implied, otherwise null.",
    },
    trackName: {
      type: ["string", "null"],
      description: "Track title if one was mentioned, otherwise null.",
    },
    steps: {
      type: "array",
      items: { type: "string" },
      description:
        "Sub-steps only if the speaker clearly listed multiple discrete steps (e.g. 'first do X, then Y, then Z'). Usually empty.",
    },
    recurrence: {
      type: ["string", "null"],
      enum: ["daily", "weekly", "biweekly", "monthly", null],
      description: "Repeat cadence if the speaker said this is recurring (e.g. 'every Friday'), otherwise null.",
    },
    reminderMinutes: {
      type: "array",
      items: { type: "integer", enum: [0, 15, 30, 60, 1440, 10080] },
      description:
        "Reminder offsets in minutes before the due date if the speaker asked for a reminder/alert. '1 day before' = 1440, '1 week before' = 10080, 'an hour before' = 60. Usually empty.",
    },
    notes: {
      type: ["string", "null"],
      description: "Any extra detail that doesn't belong in the title, otherwise null.",
    },
  },
};

export type TaskParseResult = {
  title: string;
  category: string;
  dueDate: string | null;
  priority: 0 | 1 | 2 | 3;
  assigneeName: string | null;
  projectName: string | null;
  trackName: string | null;
  steps: string[];
  recurrence: "daily" | "weekly" | "biweekly" | "monthly" | null;
  reminderMinutes: number[];
  notes: string | null;
};
