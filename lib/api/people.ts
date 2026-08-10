import { createClient } from "@/lib/supabase/client";
import type { Person, PersonAppearance } from "@/lib/types";

export type ActiveArtistProfile = Pick<
  import("@/lib/types").ArtistProfile,
  | "id"
  | "handle"
  | "display_name"
  | "emblem_url"
  | "palette_id"
  | "ice_color"
  | "amber_color"
  | "tagline"
  | "location"
  | "country_code"
  | "genres"
  | "roles"
> & { last_active_at: string };

const LEGACY_SYNTHETIC_HANDLES = new Set([
  "autotuneauntie",
  "basslinebarry",
  "choruscrisis",
  "harmonylawsuit",
  "pluginpriest",
  "softlaunch",
  "velvetstatic",
]);

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
        id, handle, display_name, emblem_url, palette_id, ice_color, amber_color, visibility, location, country_code
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

  const people = (data ?? []).map((row) => {
    const raw = row.linked_profile as unknown;
    const linked_profile = (
      Array.isArray(raw) ? raw[0] : raw
    ) as Person["linked_profile"];
    return { ...row, linked_profile: linked_profile ?? null } as Person;
  });
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

/**
 * A broad Discover pool, independent of the member's CRM and follows.
 * Readable Social posts provide the strongest activity signal; recently
 * updated/published member profiles round out the list so a newcomer can
 * discover people before the follow graph has much activity.
 */
export async function fetchRecentlyActiveProfiles(
  excludeProfileId?: string,
  limit = 48
): Promise<ActiveArtistProfile[]> {
  const supabase = createClient();
  const profileFields =
    "id, handle, display_name, emblem_url, palette_id, ice_color, amber_color, tagline, location, country_code, genres, roles, updated_at, published_at";

  const [postsResult, profilesResult] = await Promise.all([
    supabase
      .from("posts")
      .select(`created_at, author:artist_profiles!posts_author_profile_id_fkey(${profileFields})`)
      .is("scene_id", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(Math.max(limit * 3, 96)),
    (() => {
      let query = supabase
        .from("artist_profiles")
        .select(profileFields)
        .in("visibility", ["members", "public"])
        .not("handle", "is", null)
        .order("updated_at", { ascending: false })
        .limit(Math.max(limit * 2, 64));
      if (excludeProfileId) query = query.neq("id", excludeProfileId);
      return query;
    })(),
  ]);

  if (postsResult.error) throw postsResult.error;
  if (profilesResult.error) throw profilesResult.error;

  const found = new Map<string, ActiveArtistProfile>();
  for (const row of postsResult.data ?? []) {
    const raw = row.author as unknown;
    const author = (Array.isArray(raw) ? raw[0] : raw) as
      | (Omit<ActiveArtistProfile, "last_active_at"> & {
          updated_at?: string;
          published_at?: string | null;
        })
      | null;
    if (
      !author?.handle ||
      LEGACY_SYNTHETIC_HANDLES.has(author.handle.toLowerCase()) ||
      author.id === excludeProfileId ||
      found.has(author.id)
    ) continue;
    found.set(author.id, { ...author, last_active_at: row.created_at });
    if (found.size >= limit) break;
  }

  for (const profile of profilesResult.data ?? []) {
    if (
      !profile.handle ||
      LEGACY_SYNTHETIC_HANDLES.has(profile.handle.toLowerCase()) ||
      profile.id === excludeProfileId ||
      found.has(profile.id)
    ) continue;
    found.set(profile.id, {
      ...profile,
      last_active_at: profile.updated_at ?? profile.published_at ?? new Date(0).toISOString(),
    });
    if (found.size >= limit) break;
  }

  return Array.from(found.values());
}
