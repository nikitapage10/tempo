import { createClient } from "@/lib/supabase/client";
import type {
  CalendarEvent,
  CalendarEventInput,
} from "@/lib/calendar/types";

function payload(input: CalendarEventInput) {
  return {
    ...input,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    location: input.location?.trim() || null,
  };
}

export async function createCalendarEvent(
  input: CalendarEventInput
): Promise<CalendarEvent> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .insert(payload(input))
    .select()
    .single();
  if (error) throw error;
  return data as CalendarEvent;
}

export async function updateCalendarEvent(
  id: string,
  input: CalendarEventInput
): Promise<CalendarEvent> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .update(payload(input))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as CalendarEvent;
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("calendar_events").delete().eq("id", id);
  if (error) throw error;
}

