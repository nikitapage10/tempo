import { createClient } from "@/lib/supabase/client";
import type { Person, PersonAppearance } from "@/lib/types";

export async function fetchPeople(opts?: {
  source?: string;
  role?: string;
  tag?: string;
  q?: string;
  includeArchived?: boolean;
}): Promise<Person[]> {
  const supabase = createClient();
  let query = supabase
    .from("people")
    .select(
      `
      *,
      linked_profile:artist_profiles!people_linked_profile_id_fkey(
        id, handle, display_name, emblem_url, palette_id, ice_color, amber_color, visibility
      )
    `
    )
    .order("last_interaction_at", { ascending: false, nullsFirst: false })
    .order("display_name");

  if (!opts?.includeArchived) query = query.eq("is_archived", false);
  if (opts?.source) query = query.eq("source", opts.source);
  if (opts?.role) query = query.contains("roles", [opts.role]);
  if (opts?.tag) query = query.contains("tags", [opts.tag]);
  if (opts?.q?.trim()) {
    query = query.or(
      `display_name.ilike.%${opts.q.trim()}%,primary_email.ilike.%${opts.q.trim()}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  const people = (data ?? []) as Person[];
  if (!people.length) return people;

  const ids = people.map((p) => p.id);
  const { data: apps } = await supabase
    .from("person_appearances")
    .select("person_id")
    .in("person_id", ids);
  const counts = new Map<string, number>();
  for (const a of apps ?? []) {
    counts.set(a.person_id, (counts.get(a.person_id) ?? 0) + 1);
  }
  return people.map((p) => ({ ...p, appearance_count: counts.get(p.id) ?? 0 }));
}

export async function fetchPersonAppearances(
  personId: string
): Promise<PersonAppearance[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("person_appearances")
    .select("*")
    .eq("person_id", personId)
    .order("appeared_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PersonAppearance[];
}

export async function updatePerson(
  id: string,
  patch: Partial<Pick<Person, "notes" | "tags" | "roles" | "is_archived" | "display_name">>
): Promise<Person> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("people")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Person;
}

/** Discover published artist profiles by display name (pg_trgm). */
export async function searchArtistProfiles(
  q: string,
  limit = 20
): Promise<
  Pick<
    import("@/lib/types").ArtistProfile,
    | "id"
    | "handle"
    | "display_name"
    | "emblem_url"
    | "palette_id"
    | "ice_color"
    | "amber_color"
    | "tagline"
    | "visibility"
    | "roles"
  >[]
> {
  const supabase = createClient();
  const trimmed = q.trim();
  if (!trimmed) return [];

  const { data, error } = await supabase
    .from("artist_profiles")
    .select(
      "id, handle, display_name, emblem_url, palette_id, ice_color, amber_color, tagline, visibility, roles"
    )
    .in("visibility", ["members", "public"])
    .ilike("display_name", `%${trimmed}%`)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
