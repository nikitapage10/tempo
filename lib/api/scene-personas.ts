import { createClient } from "@/lib/supabase/client";
import type { ScenePersona } from "@/lib/types";

export async function fetchMyScenePersona(sceneId: string): Promise<ScenePersona | null> {
  const supabase = createClient();
  const { data: personaId, error: rpcError } = await supabase.rpc("scene_persona_id", {
    p_scene_id: sceneId,
  });
  if (rpcError || !personaId) return null;
  const { data, error } = await supabase
    .from("scene_personas")
    .select("*")
    .eq("id", personaId)
    .maybeSingle();
  if (error) throw error;
  return (data as ScenePersona) ?? null;
}
export async function fetchScenePersonas(sceneId: string): Promise<ScenePersona[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scene_personas")
    .select("*")
    .eq("scene_id", sceneId)
    .order("display_name");
  if (error) throw error;
  return (data ?? []) as ScenePersona[];
}

export async function ensureScenePersona(input: {
  sceneId: string;
  displayName: string;
  artistProfileId?: string | null;
}): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("ensure_scene_persona", {
    p_scene_id: input.sceneId,
    p_display_name: input.displayName.trim(),
    p_artist_profile_id: input.artistProfileId ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function updateScenePersona(
  personaId: string,
  patch: Partial<Pick<ScenePersona, "display_name" | "handle" | "avatar_url" | "bio" | "pronouns" | "location" | "country_code" | "links">>
): Promise<ScenePersona> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scene_personas")
    .update(patch)
    .eq("id", personaId)
    .select("*")
    .single();
  if (error) throw error;
  return data as ScenePersona;
}

export async function joinSceneWithPersona(sceneId: string, personaId: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("join_scene_v2", {
    p_scene_id: sceneId,
    p_persona_id: personaId,
  });
  if (error) throw error;
  return data as string;
}
