"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deletePreference,
  fetchExactPreference,
  resolvePreference,
  savePreference,
  type PreferenceScope,
  type SavePreferenceInput,
} from "@/lib/api/workspace-prefs";

function scopeKey(scope: PreferenceScope) {
  return [scope.trackId ?? null, scope.stageId ?? null] as const;
}

/** Effective preference for a track, resolved track > stage > global. */
export function useResolvedPreference(scope: PreferenceScope) {
  return useQuery({
    queryKey: ["workspace-pref", "resolved", ...scopeKey(scope)],
    queryFn: () => resolvePreference(scope),
  });
}

/** Whether this exact scope (not inherited) has its own override. */
export function useExactPreference(scope: PreferenceScope) {
  return useQuery({
    queryKey: ["workspace-pref", "exact", ...scopeKey(scope)],
    queryFn: () => fetchExactPreference(scope),
  });
}

export function useWorkspacePrefMutations() {
  const qc = useQueryClient();

  const invalidateAll = () =>
    qc.invalidateQueries({ queryKey: ["workspace-pref"] });

  const save = useMutation({
    mutationFn: (input: SavePreferenceInput) => savePreference(input),
    onSuccess: invalidateAll,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deletePreference(id),
    onSuccess: invalidateAll,
  });

  return { save, remove };
}
