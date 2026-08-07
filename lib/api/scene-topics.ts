import { createClient } from "@/lib/supabase/client";
import { isMissingSceneSchema } from "@/lib/api/scenes";
import type { SceneTopic } from "@/lib/types";

export async function fetchSceneTopics(sceneId: string): Promise<SceneTopic[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scene_topics")
    .select("*")
    .eq("scene_id", sceneId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true });
  if (error) {
    if (isMissingSceneSchema(error)) return [];
    throw error;
  }
  return (data ?? []) as SceneTopic[];
}

function slugifyTopic(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40) || "topic";
}

export async function createSceneTopic(input: {
  sceneId: string;
  name: string;
  description?: string | null;
  postPolicy?: "members" | "moderators";
  sortOrder?: number;
}): Promise<SceneTopic> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scene_topics")
    .insert({
      scene_id: input.sceneId,
      name: input.name.trim(),
      slug: slugifyTopic(input.name),
      description: input.description?.trim() || null,
      post_policy: input.postPolicy ?? "members",
      sort_order: input.sortOrder ?? 0,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as SceneTopic;
}
