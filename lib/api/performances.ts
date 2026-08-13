import { createClient } from "@/lib/supabase/client";

export type PerformanceRole = "headline" | "performer" | "support" | "dj" | "host" | "crew";
export type PerformanceContext =
  | "show"
  | "festival"
  | "residency"
  | "livestream"
  | "radio"
  | "session";

export type Performance = {
  id: string;
  artistId: string;
  calendarEventId: string | null;
  title: string;
  performedOn: string;
  role: PerformanceRole;
  context: PerformanceContext;
  festivalName: string | null;
  venue: string | null;
  city: string | null;
  country: string | null;
  setMinutes: number | null;
  audienceEstimate: number | null;
  paid: boolean | null;
  notes: string | null;
  createdAt: string;
};

type PerformanceRow = {
  id: string;
  artist_id: string;
  calendar_event_id: string | null;
  title: string;
  performed_on: string;
  role: PerformanceRole;
  context: PerformanceContext;
  festival_name: string | null;
  venue: string | null;
  city: string | null;
  country: string | null;
  set_minutes: number | null;
  audience_estimate: number | null;
  paid: boolean | null;
  notes: string | null;
  created_at: string;
};

const COLUMNS =
  "id, artist_id, calendar_event_id, title, performed_on, role, context, festival_name, venue, city, country, set_minutes, audience_estimate, paid, notes, created_at";

function fromRow(r: PerformanceRow): Performance {
  return {
    id: r.id,
    artistId: r.artist_id,
    calendarEventId: r.calendar_event_id,
    title: r.title,
    performedOn: r.performed_on,
    role: r.role,
    context: r.context,
    festivalName: r.festival_name,
    venue: r.venue,
    city: r.city,
    country: r.country,
    setMinutes: r.set_minutes,
    audienceEstimate: r.audience_estimate,
    paid: r.paid,
    notes: r.notes,
    createdAt: r.created_at,
  };
}

export async function fetchPerformances(artistId: string): Promise<Performance[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("performances")
    .select(COLUMNS)
    .eq("artist_id", artistId)
    .order("performed_on", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export type PerformanceInput = {
  title: string;
  performedOn: string;
  role: PerformanceRole;
  context: PerformanceContext;
  festivalName?: string | null;
  venue?: string | null;
  city?: string | null;
  country?: string | null;
  setMinutes?: number | null;
  audienceEstimate?: number | null;
  paid?: boolean | null;
  notes?: string | null;
  calendarEventId?: string | null;
};

export async function createPerformance(
  artistId: string,
  input: PerformanceInput
): Promise<Performance> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("performances")
    .insert({
      artist_id: artistId,
      calendar_event_id: input.calendarEventId ?? null,
      title: input.title,
      performed_on: input.performedOn,
      role: input.role,
      context: input.context,
      festival_name: input.context === "festival" ? (input.festivalName ?? null) : null,
      venue: input.venue ?? null,
      city: input.city ?? null,
      country: input.country ?? null,
      set_minutes: input.setMinutes ?? null,
      audience_estimate: input.audienceEstimate ?? null,
      paid: input.paid ?? null,
      notes: input.notes ?? null,
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updatePerformance(
  id: string,
  input: Partial<PerformanceInput>
): Promise<Performance> {
  const supabase = createClient();
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.performedOn !== undefined) patch.performed_on = input.performedOn;
  if (input.role !== undefined) patch.role = input.role;
  if (input.context !== undefined) patch.context = input.context;
  if (input.festivalName !== undefined) {
    patch.festival_name = input.context === "festival" ? input.festivalName : null;
  }
  if (input.venue !== undefined) patch.venue = input.venue;
  if (input.city !== undefined) patch.city = input.city;
  if (input.country !== undefined) patch.country = input.country;
  if (input.setMinutes !== undefined) patch.set_minutes = input.setMinutes;
  if (input.audienceEstimate !== undefined) patch.audience_estimate = input.audienceEstimate;
  if (input.paid !== undefined) patch.paid = input.paid;
  if (input.notes !== undefined) patch.notes = input.notes;

  const { data, error } = await supabase
    .from("performances")
    .update(patch)
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deletePerformance(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("performances").delete().eq("id", id);
  if (error) throw error;
}

export type CandidateShow = {
  calendarEventId: string;
  title: string;
  date: string;
};

/**
 * Past `live_show` calendar events not yet linked to a logged performance —
 * offered as an opt-in, tick-to-import list. Never auto-inserted: a number
 * an attribute depends on should only ever grow from something the artist
 * confirmed actually happened.
 */
export async function listCandidateCalendarShows(
  spaceIds: string[]
): Promise<CandidateShow[]> {
  if (spaceIds.length === 0) return [];
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [eventsRes, linkedRes] = await Promise.all([
    supabase
      .from("calendar_events")
      .select("id, title, start_date, all_day, starts_at")
      .in("space_id", spaceIds)
      .eq("kind", "live_show")
      .order("start_date", { ascending: false })
      .limit(100),
    supabase.from("performances").select("calendar_event_id").not("calendar_event_id", "is", null),
  ]);
  if (eventsRes.error) throw eventsRes.error;
  if (linkedRes.error) throw linkedRes.error;

  const linked = new Set((linkedRes.data ?? []).map((r) => r.calendar_event_id as string));

  return (eventsRes.data ?? [])
    .filter((e) => !linked.has(e.id))
    .map((e) => ({
      calendarEventId: e.id,
      title: e.title,
      date: (e.all_day ? e.start_date : e.starts_at?.slice(0, 10)) ?? e.start_date,
    }))
    .filter((e) => !!e.date && e.date <= today);
}
