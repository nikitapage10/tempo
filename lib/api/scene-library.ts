import { createClient } from "@/lib/supabase/client";
import type {
  SceneLibraryCollection,
  SceneLibraryItem,
  ScenePage,
  SceneShowcaseItem,
} from "@/lib/types";

export async function fetchSceneLibrary(sectionId: string): Promise<{
  collections: SceneLibraryCollection[];
  items: SceneLibraryItem[];
}> {
  const supabase = createClient();
  const [collections, items] = await Promise.all([
    supabase.from("scene_library_collections").select("*").eq("section_id", sectionId).is("archived_at", null).order("sort_order"),
    supabase.from("scene_library_items").select("*").eq("section_id", sectionId).is("archived_at", null).order("sort_order"),
  ]);
  if (collections.error) throw collections.error;
  if (items.error) throw items.error;
  return {
    collections: (collections.data ?? []) as SceneLibraryCollection[],
    items: (items.data ?? []) as SceneLibraryItem[],
  };
}

export async function fetchScenePage(sectionId: string): Promise<ScenePage | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scene_pages")
    .select("*")
    .eq("section_id", sectionId)
    .maybeSingle();
  if (error) throw error;
  return (data as ScenePage) ?? null;
}

export async function fetchSceneShowcase(sectionId: string): Promise<SceneShowcaseItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scene_showcase_items")
    .select("*")
    .eq("section_id", sectionId)
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SceneShowcaseItem[];
}

export async function createSceneLibraryItem(
  input: Omit<SceneLibraryItem, "id" | "created_at" | "updated_at" | "archived_at">
): Promise<SceneLibraryItem> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scene_library_items")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as SceneLibraryItem;
}

export async function createSceneLibraryCollection(input: { sceneId: string; sectionId: string; title: string; description?: string | null }): Promise<SceneLibraryCollection> {
  const supabase = createClient();
  const { data, error } = await supabase.from("scene_library_collections").insert({ scene_id: input.sceneId, section_id: input.sectionId, title: input.title.trim(), description: input.description?.trim() || null }).select("*").single();
  if (error) throw error;
  return data as SceneLibraryCollection;
}

export async function upsertScenePage(input: { sceneId: string; sectionId: string; blocks: ScenePage["blocks"]; publish?: boolean }): Promise<ScenePage> {
  const supabase = createClient();
  const { data, error } = await supabase.from("scene_pages").upsert({ scene_id: input.sceneId, section_id: input.sectionId, blocks: input.blocks, draft_blocks: input.blocks, published_at: input.publish ? new Date().toISOString() : null }, { onConflict: "section_id" }).select("*").single();
  if (error) throw error;
  return data as ScenePage;
}

export async function createSceneShowcaseItem(input: { sceneId: string; sectionId: string; personaId: string; title: string; description?: string | null; feedbackPrompt?: string | null; externalUrl?: string | null; visibility?: "groups" | "members" | "public" }): Promise<SceneShowcaseItem> {
  const supabase = createClient();
  const { data, error } = await supabase.from("scene_showcase_items").insert({ scene_id: input.sceneId, section_id: input.sectionId, persona_id: input.personaId, title: input.title.trim(), description: input.description?.trim() || null, feedback_prompt: input.feedbackPrompt?.trim() || null, external_url: input.externalUrl?.trim() || null, visibility: input.visibility ?? "members", status: "published" }).select("*").single();
  if (error) throw error;
  return data as SceneShowcaseItem;
}
