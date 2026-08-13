import { DEFAULT_ARTIST_NAME } from "@/lib/constants";
import type { createAdminClient } from "@/lib/supabase/admin";

type Service = ReturnType<typeof createAdminClient>;

/**
 * After an existing team (or collaborator) account redeems an artist invite,
 * they need a music artist row to run Origin — their personal home must stay.
 */
export async function ensureOriginArtistForInvite(
  service: Service,
  userId: string
): Promise<{ originArtistId: string; startOrigin: boolean }> {
  const { data: rows, error } = await service
    .from("artists")
    .select("id, workspace_kind, origin_status, sort")
    .eq("user_id", userId)
    .order("sort", { ascending: true });
  if (error) throw error;

  const owned = rows ?? [];
  const music = owned.filter((row) => row.workspace_kind !== "personal");
  const finished = music.find(
    (row) => row.origin_status === "complete" || row.origin_status === "skipped"
  );
  if (finished) {
    return { originArtistId: finished.id, startOrigin: false };
  }

  const unfinished = music.find(
    (row) =>
      row.origin_status === "not_started" || row.origin_status === "in_progress"
  );
  const hasPersonal = owned.some((row) => row.workspace_kind === "personal");
  if (unfinished && hasPersonal) {
    return { originArtistId: unfinished.id, startOrigin: true };
  }

  const nextSort =
    owned.reduce((max, row) => Math.max(max, row.sort ?? 0), -1) + 1;
  const { data: created, error: createError } = await service
    .from("artists")
    .insert({
      user_id: userId,
      name: DEFAULT_ARTIST_NAME,
      workspace_kind: "artist",
      origin_status: "not_started",
      sort: nextSort,
    })
    .select("id")
    .single();
  if (createError || !created) {
    throw createError ?? new Error("Couldn’t start an artist workspace.");
  }
  return { originArtistId: created.id, startOrigin: true };
}
