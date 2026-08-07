import { createClient } from "@/lib/supabase/client";
import { isMissingSceneSchema } from "@/lib/api/scenes";

/**
 * Resolves the scene's group conversation id — created by the 053 trigger
 * when the scene was created (or backfilled by that migration for scenes
 * that already existed). Everything past this id is the existing 031
 * messaging stack, unchanged: fetchMessages/sendMessage/useMessages/
 * useMessageMutations all work on a conversationId alone.
 */
export async function resolveSceneConversationId(sceneId: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("scene_id", sceneId)
    .is("scene_topic_id", null)
    .maybeSingle();
  if (error) {
    if (isMissingSceneSchema(error)) return null;
    throw error;
  }
  return data?.id ?? null;
}
