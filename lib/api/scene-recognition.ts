import { createClient } from "@/lib/supabase/client";
import type { SceneAnalyticsSummary, SceneBadge } from "@/lib/types";

export async function fetchSceneBadges(sceneId: string): Promise<SceneBadge[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scene_badges")
    .select("*")
    .eq("scene_id", sceneId)
    .is("archived_at", null)
    .order("name");
  if (error) throw error;
  return (data ?? []) as SceneBadge[];
}

export async function fetchSceneAnalytics(sceneId: string, days = 30): Promise<SceneAnalyticsSummary> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("scene_analytics_summary", {
    p_scene_id: sceneId,
    p_days: days,
  });
  if (error) throw error;
  return (data ?? {
    days,
    active_members: 0,
    new_members: 0,
    posts: 0,
    comments: 0,
    messages: 0,
    event_rsvps: 0,
    library_views: 0,
  }) as SceneAnalyticsSummary;
}

export async function createSceneBadge(input: { sceneId: string; name: string; description?: string | null; icon?: string; color?: string | null; points?: number }): Promise<SceneBadge> {
  const supabase = createClient();
  const { data, error } = await supabase.from("scene_badges").insert({ scene_id: input.sceneId, name: input.name.trim(), description: input.description?.trim() || null, icon: input.icon || "✨", color: input.color || null, points: input.points ?? 0 }).select("*").single();
  if (error) throw error;
  return data as SceneBadge;
}

export async function awardSceneBadge(input: { badgeId: string; personaId: string; note?: string | null }): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("award_scene_badge", { p_badge_id: input.badgeId, p_persona_id: input.personaId, p_note: input.note ?? null });
  if (error) throw error;
}
