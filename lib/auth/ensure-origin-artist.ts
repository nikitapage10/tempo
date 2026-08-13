import { DEFAULT_ARTIST_NAME } from "@/lib/constants";
import { planOriginArtistForInvite } from "@/lib/auth/origin-gate";
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
  const { count, error: memberError } = await service
    .from("artist_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "active");
  if (memberError) throw memberError;
  const hasMembership = (count ?? 0) > 0;

  const plan = planOriginArtistForInvite(owned, hasMembership);
  if (!plan.startOrigin && plan.reuseId) {
    return { originArtistId: plan.reuseId, startOrigin: false };
  }

  for (const id of plan.convertToPersonalIds) {
    const { error: convertError } = await service
      .from("artists")
      .update({
        workspace_kind: "personal",
        origin_status: "legacy_complete",
      })
      .eq("id", id)
      .eq("user_id", userId);
    if (convertError) throw convertError;
  }

  if (plan.reuseId) {
    return { originArtistId: plan.reuseId, startOrigin: true };
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
