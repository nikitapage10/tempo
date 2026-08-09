import { createClient } from "@/lib/supabase/client";
import type { SceneGroup, SceneSection, SceneSectionType } from "@/lib/types";

export async function fetchSceneSections(sceneId: string): Promise<SceneSection[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scene_sections")
    .select("*")
    .eq("scene_id", sceneId)
    .is("archived_at", null)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as SceneSection[];
}

export async function createSceneSection(input: {
  sceneId: string;
  type: SceneSectionType;
  name: string;
  slug: string;
  description?: string | null;
  icon: string;
  sortOrder: number;
}): Promise<SceneSection> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scene_sections")
    .insert({
      scene_id: input.sceneId,
      type: input.type,
      name: input.name.trim(),
      slug: input.slug.toLowerCase(),
      description: input.description?.trim() || null,
      icon: input.icon,
      sort_order: input.sortOrder,
    })
    .select("*")
    .single();
  if (error) throw error;
  if (input.type === "chat") {
    const { error: roomError } = await supabase.rpc("ensure_scene_section_conversation", { p_section_id: data.id });
    if (roomError) throw roomError;
  }
  return data as SceneSection;
}

export async function updateSceneSection(
  id: string,
  patch: Partial<Pick<SceneSection, "name" | "slug" | "description" | "icon" | "sort_order" | "post_policy" | "visibility" | "config" | "public_visible">>
): Promise<SceneSection> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scene_sections")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as SceneSection;
}

export async function archiveSceneSection(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("scene_sections")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function reorderSceneSections(ids: string[]): Promise<void> {
  const supabase = createClient();
  const writes = ids.map((id, index) =>
    supabase.from("scene_sections").update({ sort_order: (index + 1) * 10 }).eq("id", id)
  );
  const results = await Promise.all(writes);
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
}

export async function fetchSceneGroups(sceneId: string): Promise<SceneGroup[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scene_groups")
    .select("*")
    .eq("scene_id", sceneId)
    .is("archived_at", null)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as SceneGroup[];
}

export async function createSceneGroup(input: {
  sceneId: string;
  name: string;
  slug: string;
  description?: string | null;
}): Promise<SceneGroup> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scene_groups")
    .insert({
      scene_id: input.sceneId,
      name: input.name.trim(),
      slug: input.slug.toLowerCase(),
      description: input.description?.trim() || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as SceneGroup;
}
