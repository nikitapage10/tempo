export type CalendarEventKind =
  | "studio_session"
  | "meeting"
  | "content"
  | "live_show"
  | "personal"
  | "other";

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

export type CalendarData = {
  items: CalendarItem[];
  relationOptions: CalendarRelationOption[];
  eventsAvailable: boolean;
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
  { value: "other", label: "Other" },
];

