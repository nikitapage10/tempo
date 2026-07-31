export type CalendarEventKind =
  | "studio_session"
  | "meeting"
  | "content"
  | "live_show"
  | "personal"
  | "milestone"
  | "other";

export type CalendarRecurrence = "none" | "daily" | "weekly" | "monthly";
export type CalendarMilestoneStage =
  | "writing"
  | "recording"
  | "mixing"
  | "mastering"
  | "pitching"
  | "release";

export type CalendarLink = { label: string; url: string };

export type CalendarEvent = {
  id: string;
  user_id: string;
  space_id: string;
  track_id: string | null;
  project_id: string | null;
  title: string;
  kind: CalendarEventKind;
  description: string | null;
  location: string | null;
  all_day: boolean;
  start_date: string | null;
  end_date: string | null;
  starts_at: string | null;
  ends_at: string | null;
  timezone: string | null;
  recurrence: CalendarRecurrence;
  recurrence_until: string | null;
  reminder_minutes: number[];
  participants: string[];
  links: CalendarLink[];
  attachment_urls: string[];
  milestone_stage: CalendarMilestoneStage | null;
  dependency_event_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CalendarEventInput = Omit<
  CalendarEvent,
  "id" | "user_id" | "created_at" | "updated_at"
>;

export type CalendarSource =
  | "task_due"
  | "track_deadline"
  | "track_next_action"
  | "project_deadline"
  | "release_date"
  | "pitching_deadline"
  | "custom_event";

export type CalendarSourceGroup =
  | "tasks"
  | "tracks"
  | "projects"
  | "releases"
  | "events";

export type CalendarItemState =
  | "default"
  | "blocked"
  | "overdue"
  | "today"
  | "completed";

export type CalendarItem = {
  id: string;
  source: CalendarSource;
  sourceGroup: CalendarSourceGroup;
  sourceId: string;
  spaceId: string;
  spaceLabel: string;
  title: string;
  subtitle: string | null;
  date: string;
  endDate: string | null;
  allDay: boolean;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string | null;
  state: CalendarItemState;
  destinationHref: string;
  relationLabel: string | null;
  artworkPath: string | null;
  event: CalendarEvent | null;
};

export type CalendarRelationOption = {
  id: string;
  spaceId: string;
  type: "track" | "project";
  label: string;
};

export type UnscheduledCalendarItem = {
  id: string;
  source: "task" | "track_next_action";
  sourceId: string;
  spaceId: string;
  title: string;
  subtitle: string | null;
  destinationHref: string;
};

export type CalendarComment = {
  id: string;
  event_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

export type CalendarActivity = {
  id: string;
  event_id: string;
  user_id: string;
  action: string;
  summary: string;
  created_at: string;
};

export type CalendarData = {
  items: CalendarItem[];
  relationOptions: CalendarRelationOption[];
  unscheduled: UnscheduledCalendarItem[];
  eventsAvailable: boolean;
  planningAvailable: boolean;
};

export const CALENDAR_EVENT_KINDS: {
  value: CalendarEventKind;
  label: string;
}[] = [
  { value: "studio_session", label: "Studio session" },
  { value: "meeting", label: "Meeting" },
  { value: "content", label: "Content" },
  { value: "live_show", label: "Live / show" },
  { value: "personal", label: "Personal" },
  { value: "milestone", label: "Milestone" },
  { value: "other", label: "Other" },
];
