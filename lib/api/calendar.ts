import { createClient } from "@/lib/supabase/client";
import { dateInTimeZone } from "@/lib/calendar/date";
import type {
  CalendarData,
  CalendarEvent,
  CalendarItem,
  CalendarItemState,
  CalendarRelationOption,
} from "@/lib/calendar/types";

type CalendarQueryInput = {
  spaceIds: string[];
  spaceLabels: Record<string, string>;
  rangeStart: string;
  rangeEndExclusive: string;
  today: string;
};

function inRange(date: string, start: string, end: string) {
  return date >= start && date < end;
}

function derivedState(input: {
  date: string;
  today: string;
  completed?: boolean;
  blocked?: boolean;
  overdueEligible?: boolean;
}): CalendarItemState {
  if (input.completed) return "completed";
  if (input.overdueEligible && input.date < input.today) return "overdue";
  if (input.blocked) return "blocked";
  if (input.date === input.today) return "today";
  return "default";
}

function isMissingEventsTable(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("calendar_events") === true
  );
}

export async function fetchCalendarData(
  input: CalendarQueryInput
): Promise<CalendarData> {
  if (input.spaceIds.length === 0) {
    return { items: [], relationOptions: [], eventsAvailable: true };
  }
  const supabase = createClient();
  const [tasksRes, tracksRes, projectsRes, eventsRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,user_id,space_id,track_id,project_id,title,status,due_date")
      .in("space_id", input.spaceIds)
      .not("due_date", "is", null),
    supabase
      .from("tracks")
      .select("id,user_id,space_id,project_id,title,deadline,next_action,next_action_due,blocked_reason,artwork_url")
      .in("space_id", input.spaceIds)
      .or("deadline.not.is.null,next_action_due.not.is.null"),
    supabase
      .from("projects")
      .select("id,user_id,space_id,name,status,project_type,deadline")
      .in("space_id", input.spaceIds),
    supabase.from("calendar_events").select("*").in("space_id", input.spaceIds),
  ]);

  if (tasksRes.error) throw tasksRes.error;
  if (tracksRes.error) throw tracksRes.error;
  if (projectsRes.error) throw projectsRes.error;
  const eventsAvailable = !isMissingEventsTable(eventsRes.error);
  if (eventsRes.error && eventsAvailable) throw eventsRes.error;

  const tasks = tasksRes.data ?? [];
  const tracks = tracksRes.data ?? [];
  const projects = projectsRes.data ?? [];
  const events = (eventsAvailable ? eventsRes.data ?? [] : []) as CalendarEvent[];
  const projectIds = projects.map((project) => project.id);
  const releasesRes = projectIds.length
    ? await supabase
        .from("release_details")
        .select("project_id,release_date,pitching_deadline")
        .in("project_id", projectIds)
    : { data: [], error: null };
  if (releasesRes.error) throw releasesRes.error;

  const projectById = new Map(projects.map((project) => [project.id, project]));
  const trackById = new Map(tracks.map((track) => [track.id, track]));
  const relationOptions: CalendarRelationOption[] = [
    ...tracks.map((track) => ({
      id: track.id,
      spaceId: track.space_id,
      type: "track" as const,
      label: track.title,
    })),
    ...projects.map((project) => ({
      id: project.id,
      spaceId: project.space_id!,
      type: "project" as const,
      label: project.name,
    })),
  ];
  const items: CalendarItem[] = [];
  const keepDerived = (date: string, overdueEligible: boolean) =>
    inRange(date, input.rangeStart, input.rangeEndExclusive) ||
    (overdueEligible && date < input.today);

  for (const task of tasks) {
    if (!task.due_date) continue;
    const overdueEligible = task.status !== "done";
    if (!keepDerived(task.due_date, overdueEligible)) continue;
    const track = task.track_id ? trackById.get(task.track_id) : null;
    const project = task.project_id ? projectById.get(task.project_id) : null;
    items.push({
      id: `task_due:${task.id}`,
      source: "task_due",
      sourceGroup: "tasks",
      sourceId: task.id,
      spaceId: task.space_id!,
      spaceLabel: input.spaceLabels[task.space_id!] ?? "Space",
      title: task.title,
      subtitle: task.status === "done" ? "Completed task" : "Task due",
      date: task.due_date,
      endDate: null,
      allDay: true,
      startsAt: null,
      endsAt: null,
      timezone: null,
      state: derivedState({
        date: task.due_date,
        today: input.today,
        completed: task.status === "done",
        overdueEligible,
      }),
      destinationHref: `/tasks?edit=${task.id}`,
      relationLabel: track?.title ?? project?.name ?? null,
      artworkPath: track?.artwork_url ?? null,
      event: null,
    });
  }

  for (const track of tracks) {
    if (track.deadline && keepDerived(track.deadline, true)) {
      items.push({
        id: `track_deadline:${track.id}`,
        source: "track_deadline",
        sourceGroup: "tracks",
        sourceId: track.id,
        spaceId: track.space_id,
        spaceLabel: input.spaceLabels[track.space_id] ?? "Space",
        title: track.title,
        subtitle: "Track target",
        date: track.deadline,
        endDate: null,
        allDay: true,
        startsAt: null,
        endsAt: null,
        timezone: null,
        state: derivedState({
          date: track.deadline,
          today: input.today,
          blocked: !!track.blocked_reason,
          overdueEligible: true,
        }),
        destinationHref: `/track/${track.id}?edit=deadline`,
        relationLabel: track.title,
        artworkPath: track.artwork_url,
        event: null,
      });
    }
    if (track.next_action_due && keepDerived(track.next_action_due, true)) {
      items.push({
        id: `track_next_action:${track.id}`,
        source: "track_next_action",
        sourceGroup: "tracks",
        sourceId: track.id,
        spaceId: track.space_id,
        spaceLabel: input.spaceLabels[track.space_id] ?? "Space",
        title: track.next_action || "Next move",
        subtitle: `${track.title} · Next`,
        date: track.next_action_due,
        endDate: null,
        allDay: true,
        startsAt: null,
        endsAt: null,
        timezone: null,
        state: derivedState({
          date: track.next_action_due,
          today: input.today,
          blocked: !!track.blocked_reason,
          overdueEligible: true,
        }),
        destinationHref: `/track/${track.id}?edit=next-action`,
        relationLabel: track.title,
        artworkPath: track.artwork_url,
        event: null,
      });
    }
  }

  for (const project of projects) {
    if (
      project.status === "active" &&
      project.deadline &&
      keepDerived(project.deadline, true)
    ) {
      items.push({
        id: `project_deadline:${project.id}`,
        source: "project_deadline",
        sourceGroup: "projects",
        sourceId: project.id,
        spaceId: project.space_id!,
        spaceLabel: input.spaceLabels[project.space_id!] ?? "Space",
        title: project.name,
        subtitle: "Project deadline",
        date: project.deadline,
        endDate: null,
        allDay: true,
        startsAt: null,
        endsAt: null,
        timezone: null,
        state: derivedState({
          date: project.deadline,
          today: input.today,
          overdueEligible: true,
        }),
        destinationHref: `/projects/${project.id}?edit=deadline`,
        relationLabel: project.name,
        artworkPath: null,
        event: null,
      });
    }
  }

  for (const release of releasesRes.data ?? []) {
    const project = projectById.get(release.project_id);
    if (!project?.space_id) continue;
    if (
      release.release_date &&
      inRange(release.release_date, input.rangeStart, input.rangeEndExclusive)
    ) {
      items.push({
        id: `release_date:${project.id}`,
        source: "release_date",
        sourceGroup: "releases",
        sourceId: project.id,
        spaceId: project.space_id,
        spaceLabel: input.spaceLabels[project.space_id] ?? "Space",
        title: project.name,
        subtitle: "Release day",
        date: release.release_date,
        endDate: null,
        allDay: true,
        startsAt: null,
        endsAt: null,
        timezone: null,
        state: derivedState({ date: release.release_date, today: input.today }),
        destinationHref: `/projects/${project.id}?edit=release-date`,
        relationLabel: project.name,
        artworkPath: null,
        event: null,
      });
    }
    if (
      release.pitching_deadline &&
      keepDerived(release.pitching_deadline, true)
    ) {
      items.push({
        id: `pitching_deadline:${project.id}`,
        source: "pitching_deadline",
        sourceGroup: "releases",
        sourceId: project.id,
        spaceId: project.space_id,
        spaceLabel: input.spaceLabels[project.space_id] ?? "Space",
        title: project.name,
        subtitle: "Pitching deadline",
        date: release.pitching_deadline,
        endDate: null,
        allDay: true,
        startsAt: null,
        endsAt: null,
        timezone: null,
        state: derivedState({
          date: release.pitching_deadline,
          today: input.today,
          overdueEligible: true,
        }),
        destinationHref: `/projects/${project.id}?edit=pitching-deadline`,
        relationLabel: project.name,
        artworkPath: null,
        event: null,
      });
    }
  }

  for (const event of events) {
    const timezone = event.timezone || "UTC";
    const date = event.all_day
      ? event.start_date!
      : dateInTimeZone(event.starts_at!, timezone);
    const endDate = event.all_day
      ? event.end_date
      : event.ends_at
        ? dateInTimeZone(event.ends_at, timezone)
        : null;
    const effectiveEnd = endDate ?? date;
    if (date >= input.rangeEndExclusive || effectiveEnd < input.rangeStart) continue;
    const relation = event.track_id
      ? trackById.get(event.track_id)?.title
      : event.project_id
        ? projectById.get(event.project_id)?.name
        : null;
    const artwork = event.track_id
      ? trackById.get(event.track_id)?.artwork_url ?? null
      : null;
    items.push({
      id: `custom_event:${event.id}`,
      source: "custom_event",
      sourceGroup: "events",
      sourceId: event.id,
      spaceId: event.space_id,
      spaceLabel: input.spaceLabels[event.space_id] ?? "Space",
      title: event.title,
      subtitle: event.location || relation || "Event",
      date,
      endDate,
      allDay: event.all_day,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      timezone: event.timezone,
      state: derivedState({ date, today: input.today }),
      destinationHref: `/calendar?event=${event.id}`,
      relationLabel: relation ?? null,
      artworkPath: artwork,
      event,
    });
  }

  return { items, relationOptions, eventsAvailable };
}

