import { createClient } from "@/lib/supabase/client";
import { isMissingSceneSchema } from "@/lib/api/scenes";
import type { SceneEvent, SceneEventKind, SceneEventRsvp, SceneRsvpResponse } from "@/lib/types";

/** Events with the caller's own RSVP merged in as `my_response`, so an event
 *  card never needs a second round trip per card to know its own state. */
export async function fetchSceneEvents(
  sceneId: string,
  myProfileId?: string | null
): Promise<SceneEvent[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scene_events")
    .select("*")
    .eq("scene_id", sceneId)
    .is("cancelled_at", null)
    .order("start_date", { ascending: true, nullsFirst: false })
    .order("starts_at", { ascending: true, nullsFirst: false });
  if (error) {
    if (isMissingSceneSchema(error)) return [];
    throw error;
  }
  const events = (data ?? []) as SceneEvent[];
  if (!myProfileId || !events.length) return events;

  const { data: mine } = await supabase
    .from("scene_event_rsvps")
    .select("event_id, response")
    .eq("profile_id", myProfileId)
    .in(
      "event_id",
      events.map((e) => e.id)
    );
  const byEvent = new Map((mine ?? []).map((r) => [r.event_id, r.response]));
  return events.map((e) => ({ ...e, my_response: byEvent.get(e.id) ?? null }));
}

/** For a manager's roster view — everyone who's responded, most recent first. */
export async function fetchEventRsvpRoster(eventId: string): Promise<SceneEventRsvp[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scene_event_rsvps")
    .select(
      "*, profile:artist_profiles!scene_event_rsvps_profile_id_fkey(id, handle, display_name, emblem_url, palette_id)"
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingSceneSchema(error)) return [];
    throw error;
  }
  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const profileRaw = row.profile;
    const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
    return { ...row, profile: profile ?? null } as SceneEventRsvp;
  });
}

/** All-day only for now — a plain start/end date, no timezone handling. */
export async function createSceneEvent(input: {
  sceneId: string;
  createdByProfileId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  locationUrl?: string | null;
  kind: SceneEventKind;
  startDate: string;
  endDate?: string | null;
  capacity?: number | null;
  rsvpDeadline?: string | null;
}): Promise<SceneEvent> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Signed out");

  const { data, error } = await supabase
    .from("scene_events")
    .insert({
      scene_id: input.sceneId,
      created_by_profile_id: input.createdByProfileId,
      created_by_user_id: user.id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      location: input.location?.trim() || null,
      location_url: input.locationUrl?.trim() || null,
      kind: input.kind,
      all_day: true,
      start_date: input.startDate,
      end_date: input.endDate || null,
      capacity: input.capacity ?? null,
      rsvp_deadline: input.rsvpDeadline ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as SceneEvent;
}

export async function cancelSceneEvent(eventId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("scene_events")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", eventId);
  if (error) throw error;
}

export async function setEventRsvp(input: {
  eventId: string;
  sceneId: string;
  profileId: string;
  response: SceneRsvpResponse;
  note?: string | null;
}): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Signed out");

  const { error } = await supabase.from("scene_event_rsvps").upsert(
    {
      event_id: input.eventId,
      scene_id: input.sceneId,
      profile_id: input.profileId,
      user_id: user.id,
      response: input.response,
      note: input.note ?? null,
    },
    { onConflict: "event_id,profile_id" }
  );
  if (error) throw error;
}

export async function clearEventRsvp(eventId: string, profileId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("scene_event_rsvps")
    .delete()
    .eq("event_id", eventId)
    .eq("profile_id", profileId);
  if (error) throw error;
}
