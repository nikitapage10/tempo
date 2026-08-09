import { createClient } from "@/lib/supabase/client";
import { isMissingSceneSchema } from "@/lib/api/scenes";

/**
 * Resolves the scene's group conversation id — created by the 053 trigger
 * when the scene was created (or backfilled by that migration for scenes
 * that already existed). Everything past this id is the existing 031
 * messaging stack, unchanged: fetchMessages/sendMessage/useMessages/
 * useMessageMutations all work on a conversationId alone.
 */
export async function resolveSceneConversationId(sceneId: string, sectionId?: string | null): Promise<string | null> {
  const supabase = createClient();
  let query = supabase
    .from("conversations")
    .select("id")
    .eq("scene_id", sceneId);
  query = sectionId ? query.eq("scene_section_id", sectionId) : query.is("scene_section_id", null);
  const { data, error } = await query.maybeSingle();
  if (error) {
    if (isMissingSceneSchema(error)) return null;
    throw error;
  }
  return data?.id ?? null;
}
