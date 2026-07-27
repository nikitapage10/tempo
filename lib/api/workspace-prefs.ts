import { createClient } from "@/lib/supabase/client";
import type { WorkspacePreference, WorkspacePreset } from "@/lib/types";

function normalizePreference(row: WorkspacePreference): WorkspacePreference {
  return {
    ...row,
    module_order: row.module_order ?? [],
    hidden_modules: row.hidden_modules ?? [],
  };
}

export type PreferenceScope = {
  trackId?: string | null;
  stageId?: string | null;
};

/** Exact-scope lookup — does NOT fall back to stage/global. Null if this exact scope has no override. */
export async function fetchExactPreference(
  scope: PreferenceScope
): Promise<WorkspacePreference | null> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  let query = supabase
    .from("user_track_workspace_preferences")
    .select("*")
    .eq("user_id", userData.user.id);

  if (scope.trackId) {
    query = query.eq("track_id", scope.trackId);
  } else if (scope.stageId) {
    query = query.eq("stage_id", scope.stageId);
  } else {
    query = query.is("track_id", null).is("stage_id", null);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ? normalizePreference(data) : null;
}

/**
 * Resolves the effective workspace preference for a track: a track-specific
 * override wins, then a stage-specific one, then the user's global default.
 * Returns null if none of the three exist (caller should fall back to a
 * built-in default preset).
 */
export async function resolvePreference(
  input: PreferenceScope
): Promise<WorkspacePreference | null> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const userId = userData.user.id;

  const [trackRes, stageRes, globalRes] = await Promise.all([
    input.trackId
      ? supabase
          .from("user_track_workspace_preferences")
          .select("*")
          .eq("user_id", userId)
          .eq("track_id", input.trackId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    input.stageId
      ? supabase
          .from("user_track_workspace_preferences")
          .select("*")
          .eq("user_id", userId)
          .eq("stage_id", input.stageId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("user_track_workspace_preferences")
      .select("*")
      .eq("user_id", userId)
      .is("track_id", null)
      .is("stage_id", null)
      .maybeSingle(),
  ]);

  if (trackRes.error) throw trackRes.error;
  if (stageRes.error) throw stageRes.error;
  if (globalRes.error) throw globalRes.error;

  const resolved = trackRes.data ?? stageRes.data ?? globalRes.data;
  return resolved ? normalizePreference(resolved) : null;
}

export type SavePreferenceInput = PreferenceScope & {
  preset?: WorkspacePreset;
  moduleOrder?: string[];
  hiddenModules?: string[];
  defaultPanel?: string | null;
  compactMode?: boolean;
};

/**
 * Creates or updates the preference row for one exact scope (track, stage,
 * or global — never more than one at a time). All three scopes use partial
 * unique indexes in Postgres, so this reads the existing row first and then
 * updates or inserts rather than relying on a single ON CONFLICT upsert.
 */
export async function savePreference(
  input: SavePreferenceInput
): Promise<WorkspacePreference> {
  if (input.trackId && input.stageId) {
    throw new Error("A preference can be scoped to a track or a stage, not both.");
  }

  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) {
    throw new Error("You’re signed out — sign in again, then retry.");
  }

  const scope: PreferenceScope = {
    trackId: input.trackId ?? null,
    stageId: input.stageId ?? null,
  };
  const existing = await fetchExactPreference(scope);

  const fields = {
    preset: input.preset ?? existing?.preset ?? "custom",
    module_order: input.moduleOrder ?? existing?.module_order ?? [],
    hidden_modules: input.hiddenModules ?? existing?.hidden_modules ?? [],
    default_panel:
      input.defaultPanel !== undefined
        ? input.defaultPanel
        : existing?.default_panel ?? null,
    compact_mode: input.compactMode ?? existing?.compact_mode ?? false,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await supabase
      .from("user_track_workspace_preferences")
      .update(fields)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return normalizePreference(data);
  }

  const { data, error } = await supabase
    .from("user_track_workspace_preferences")
    .insert({
      user_id: userData.user.id,
      track_id: scope.trackId,
      stage_id: scope.stageId,
      ...fields,
    })
    .select()
    .single();
  if (error) throw error;
  return normalizePreference(data);
}

export async function deletePreference(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("user_track_workspace_preferences")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
