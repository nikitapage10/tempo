import { createClient } from "@/lib/supabase/client";
import type {
  CalendarActivity,
  CalendarComment,
  CalendarEvent,
  CalendarEventInput,
  CalendarItem,
  UnscheduledCalendarItem,
} from "@/lib/calendar/types";
import { addDateKey, zonedLocalToUtc } from "@/lib/calendar/date";

function payload(input: CalendarEventInput) {
  return {
    ...input,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    location: input.location?.trim() || null,
  };
}

function legacyPayload(input: CalendarEventInput) {
  const { recurrence: _recurrence, recurrence_until: _until, reminder_minutes: _reminders, participants: _participants, links: _links, attachment_urls: _attachments, milestone_stage: _stage, dependency_event_id: _dependency, completed_at: _completed, ...legacy } = payload(input);
  return legacy;
}

function missingPlanningColumns(error: { code?: string; message?: string }) {
  return error.code === "PGRST204" || error.code === "42703" || error.message?.includes("recurrence") === true;
}

export async function createCalendarEvent(
  input: CalendarEventInput
): Promise<CalendarEvent> {
  const supabase = createClient();
  let { data, error } = await supabase
    .from("calendar_events")
    .insert(payload(input))
    .select()
    .single();
  if (error && missingPlanningColumns(error)) {
    const fallback = await supabase.from("calendar_events").insert(legacyPayload(input)).select().single();
    data = fallback.data;
    error = fallback.error;
  }
  if (error) throw error;
  return data as CalendarEvent;
}

export async function updateCalendarEvent(
  id: string,
  input: CalendarEventInput
): Promise<CalendarEvent> {
  const supabase = createClient();
  let { data, error } = await supabase
    .from("calendar_events")
    .update(payload(input))
    .eq("id", id)
    .select()
    .single();
  if (error && missingPlanningColumns(error)) {
    const fallback = await supabase.from("calendar_events").update(legacyPayload(input)).eq("id", id).select().single();
    data = fallback.data;
    error = fallback.error;
  }
  if (error) throw error;
  return data as CalendarEvent;
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("calendar_events").delete().eq("id", id);
  if (error) throw error;
}

function shiftIsoDate(iso: string | null, days: number) {
  if (!iso) return null;
  const next = new Date(iso);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}

function eventInput(event: CalendarEvent): CalendarEventInput {
  const { id: _id, user_id: _user, created_at: _created, updated_at: _updated, ...input } = event;
  return input;
}

export async function rescheduleCalendarItem(
  item: CalendarItem,
  date: string,
  cascadeDependencies = false,
  /** HH:MM in the event's own timezone — set when dragging on the week time grid, where the drop also carries a new time-of-day, not just a new date. */
  time?: string
) {
  const supabase = createClient();
  if (item.source === "custom_event" && item.event) {
    const delta = Math.round(
      (new Date(`${date}T12:00:00`).getTime() - new Date(`${item.date}T12:00:00`).getTime()) /
        86400000
    );
    const input = eventInput(item.event);
    if (input.all_day) {
      input.start_date = addDateKey(input.start_date!, delta);
      input.end_date = input.end_date ? addDateKey(input.end_date, delta) : null;
    } else if (time) {
      const zone = input.timezone || "UTC";
      const durationMs =
        input.ends_at && input.starts_at
          ? new Date(input.ends_at).getTime() - new Date(input.starts_at).getTime()
          : null;
      const newStart = zonedLocalToUtc(date, time, zone);
      input.starts_at = newStart;
      input.ends_at = durationMs != null ? new Date(new Date(newStart).getTime() + durationMs).toISOString() : null;
    } else {
      input.starts_at = shiftIsoDate(input.starts_at, delta);
      input.ends_at = shiftIsoDate(input.ends_at, delta);
    }
    const updated = await updateCalendarEvent(item.sourceId, input);
    if (cascadeDependencies) {
      const { data: dependents, error } = await supabase.from("calendar_events").select("id,all_day,start_date,end_date,starts_at,ends_at").eq("dependency_event_id", item.sourceId);
      if (error) throw error;
      for (const dependent of dependents ?? []) {
        const patch = dependent.all_day
          ? { start_date: addDateKey(dependent.start_date!, delta), end_date: dependent.end_date ? addDateKey(dependent.end_date, delta) : null }
          : { starts_at: shiftIsoDate(dependent.starts_at, delta), ends_at: shiftIsoDate(dependent.ends_at, delta) };
        const { error: updateError } = await supabase.from("calendar_events").update(patch).eq("id", dependent.id);
        if (updateError) throw updateError;
      }
    }
    return updated;
  }
  const table =
    item.source === "task_due"
      ? "tasks"
      : item.source === "track_deadline" || item.source === "track_next_action"
        ? "tracks"
        : item.source === "project_deadline"
          ? "projects"
          : "release_details";
  const patch =
    item.source === "task_due"
      ? { due_date: date }
      : item.source === "track_deadline"
        ? { deadline: date }
        : item.source === "track_next_action"
          ? { next_action_due: date }
          : item.source === "project_deadline"
            ? { deadline: date }
            : item.source === "release_date"
              ? { release_date: date }
              : { pitching_deadline: date };
  const key = table === "release_details" ? "project_id" : "id";
  const { error } = await supabase.from(table).update(patch).eq(key, item.sourceId);
  if (error) throw error;
}

export async function scheduleUnscheduledItem(item: UnscheduledCalendarItem, date: string) {
  const supabase = createClient();
  const table = item.source === "task" ? "tasks" : "tracks";
  const patch = item.source === "task" ? { due_date: date } : { next_action_due: date };
  const { error } = await supabase.from(table).update(patch).eq("id", item.sourceId);
  if (error) throw error;
}

export async function duplicateCalendarEvent(event: CalendarEvent, date?: string) {
  const input = eventInput(event);
  input.title = `${input.title} copy`;
  if (date && input.all_day) {
    const duration = input.end_date && input.start_date
      ? Math.max(0, Math.round((new Date(`${input.end_date}T12:00:00`).getTime() - new Date(`${input.start_date}T12:00:00`).getTime()) / 86400000))
      : 0;
    input.start_date = date;
    input.end_date = duration ? addDateKey(date, duration) : null;
  }
  return createCalendarEvent(input);
}

export async function fetchCalendarDiscussion(eventId: string): Promise<{
  comments: CalendarComment[];
  activity: CalendarActivity[];
}> {
  const supabase = createClient();
  const [comments, activity] = await Promise.all([
    supabase.from("calendar_event_comments").select("*").eq("event_id", eventId).order("created_at"),
    supabase.from("calendar_event_activity").select("*").eq("event_id", eventId).order("created_at", { ascending: false }),
  ]);
  if (comments.error) throw comments.error;
  if (activity.error) throw activity.error;
  return { comments: (comments.data ?? []) as CalendarComment[], activity: (activity.data ?? []) as CalendarActivity[] };
}

export async function addCalendarComment(eventId: string, body: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("calendar_event_comments")
    .insert({ event_id: eventId, body: body.trim() })
    .select()
    .single();
  if (error) throw error;
  return data as CalendarComment;
}

export async function deliverCalendarReminders() {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("deliver_calendar_reminders");
  if (error && error.code !== "PGRST202" && error.code !== "42883") throw error;
  return Number(data ?? 0);
}
