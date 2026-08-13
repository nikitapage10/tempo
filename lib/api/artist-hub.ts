import { createClient } from "@/lib/supabase/client";
import { canRead, type AreaGrants } from "@/lib/team/areas";

export type ArtistHubSnapshot = {
  upcoming: { id: string; title: string; startAt: string }[];
  trackCount: number | null;
};

function isMissingTable(error: { message?: string } | null): boolean {
  return /schema cache|does not exist|42P01|PGRST205/i.test(error?.message ?? "");
}

/** High-level facts a team member may see for an artist they work with. */
export async function fetchArtistHubSnapshot(
  artistId: string,
  areas: AreaGrants
): Promise<ArtistHubSnapshot> {
  const supabase = createClient();
  const snapshot: ArtistHubSnapshot = { upcoming: [], trackCount: null };

  const { data: spaces, error: spacesError } = await supabase
    .from("spaces")
    .select("id")
    .eq("artist_id", artistId);
  if (spacesError && !isMissingTable(spacesError)) throw new Error(spacesError.message);
  const spaceIds = (spaces ?? []).map((s) => s.id);
  if (spaceIds.length === 0) return snapshot;

  if (canRead(areas, "catalog")) {
    const { count, error } = await supabase
      .from("tracks")
      .select("id", { count: "exact", head: true })
      .in("space_id", spaceIds);
    if (!error) snapshot.trackCount = count ?? 0;
  }

  if (canRead(areas, "calendar")) {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("calendar_events")
      .select("id, title, starts_at, start_date")
      .in("space_id", spaceIds)
      .limit(24);
    if (error && !isMissingTable(error)) throw new Error(error.message);
    snapshot.upcoming = (data ?? [])
      .map((row) => ({
        id: row.id as string,
        title: (row.title as string) ?? "Event",
        startAt: (row.starts_at as string | null) ?? (row.start_date as string | null) ?? "",
      }))
      .filter((row) => row.startAt && (row.startAt >= now || row.startAt >= today))
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .slice(0, 3);
  }

  return snapshot;
}
