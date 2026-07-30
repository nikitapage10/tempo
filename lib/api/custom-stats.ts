import { createClient } from "@/lib/supabase/client";

export type CustomStatEntry = {
  id: string;
  stat_id: string;
  value: number;
  recorded_on: string;
  created_at: string;
};

export type CustomStat = {
  id: string;
  module_id: string;
  label: string;
  unit: string | null;
  sort_order: number;
  /** Oldest first — trend lines read straight off this. */
  entries: CustomStatEntry[];
};

export type CustomStatModule = {
  id: string;
  artist_id: string;
  title: string;
  sort_order: number;
  stats: CustomStat[];
};

/** True when migration 025 hasn't been run yet. */
export function isMissingCustomStatsSchema(error: {
  message?: string;
}): boolean {
  return /artist_custom_(modules|stats|stat_entries)/i.test(
    error?.message ?? ""
  );
}

export async function fetchCustomModules(
  artistId: string
): Promise<CustomStatModule[]> {
  const supabase = createClient();

  const { data: modules, error: modulesError } = await supabase
    .from("artist_custom_modules")
    .select("id, artist_id, title, sort_order")
    .eq("artist_id", artistId)
    .order("sort_order", { ascending: true });
  if (modulesError) {
    if (isMissingCustomStatsSchema(modulesError)) return [];
    throw modulesError;
  }
  if (!modules || modules.length === 0) return [];

  const moduleIds = modules.map((m) => m.id);
  const { data: stats, error: statsError } = await supabase
    .from("artist_custom_stats")
    .select("id, module_id, label, unit, sort_order")
    .in("module_id", moduleIds)
    .order("sort_order", { ascending: true });
  if (statsError) throw statsError;

  const statIds = (stats ?? []).map((s) => s.id);
  const { data: entries, error: entriesError } =
    statIds.length > 0
      ? await supabase
          .from("artist_custom_stat_entries")
          .select("id, stat_id, value, recorded_on, created_at")
          .in("stat_id", statIds)
          .order("recorded_on", { ascending: true })
          .order("created_at", { ascending: true })
      : { data: [] as CustomStatEntry[], error: null };
  if (entriesError) throw entriesError;

  return modules.map((m) => ({
    ...m,
    stats: (stats ?? [])
      .filter((s) => s.module_id === m.id)
      .map((s) => ({
        ...s,
        entries: (entries ?? []).filter((e) => e.stat_id === s.id),
      })),
  }));
}

export async function createCustomModule(
  artistId: string,
  title: string,
  sortOrder: number
): Promise<CustomStatModule> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("artist_custom_modules")
    .insert({ artist_id: artistId, title, sort_order: sortOrder })
    .select("id, artist_id, title, sort_order")
    .single();
  if (error) throw error;
  return { ...data, stats: [] };
}

export async function renameCustomModule(
  moduleId: string,
  title: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("artist_custom_modules")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", moduleId);
  if (error) throw error;
}

export async function deleteCustomModule(moduleId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("artist_custom_modules")
    .delete()
    .eq("id", moduleId);
  if (error) throw error;
}

export async function createCustomStat(
  moduleId: string,
  label: string,
  unit: string | null,
  sortOrder: number
): Promise<CustomStat> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("artist_custom_stats")
    .insert({ module_id: moduleId, label, unit, sort_order: sortOrder })
    .select("id, module_id, label, unit, sort_order")
    .single();
  if (error) throw error;
  return { ...data, entries: [] };
}

export async function deleteCustomStat(statId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("artist_custom_stats")
    .delete()
    .eq("id", statId);
  if (error) throw error;
}

/**
 * Logs a reading for any day — today, or an earlier day being back-filled.
 * Always adds a new entry; several readings the same day are kept side by
 * side rather than one overwriting the last (migration 026).
 */
export async function logCustomStatValue(
  statId: string,
  value: number,
  recordedOn: string
): Promise<CustomStatEntry> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("artist_custom_stat_entries")
    .insert({ stat_id: statId, value, recorded_on: recordedOn })
    .select("id, stat_id, value, recorded_on, created_at")
    .single();
  if (error) throw error;
  return data;
}

/** Undo a mis-entered reading. */
export async function deleteCustomStatEntry(entryId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("artist_custom_stat_entries")
    .delete()
    .eq("id", entryId);
  if (error) throw error;
}
