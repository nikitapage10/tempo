"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCustomModule,
  createCustomStat,
  deleteCustomModule,
  deleteCustomStat,
  deleteCustomStatEntry,
  fetchCustomModules,
  logCustomStatValue,
  renameCustomModule,
} from "@/lib/api/custom-stats";

export function useCustomModules(artistId: string | null) {
  return useQuery({
    queryKey: ["custom-modules", artistId],
    queryFn: () => fetchCustomModules(artistId!),
    enabled: !!artistId,
    staleTime: 30_000,
  });
}

export function useCustomModuleMutations(artistId: string | null) {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["custom-modules", artistId] });

  const addModule = useMutation({
    mutationFn: ({
      title,
      sortOrder,
    }: {
      title: string;
      sortOrder: number;
    }) => createCustomModule(artistId!, title, sortOrder),
    onSuccess: invalidate,
  });

  const renameModule = useMutation({
    mutationFn: ({ moduleId, title }: { moduleId: string; title: string }) =>
      renameCustomModule(moduleId, title),
    onSuccess: invalidate,
  });

  const removeModule = useMutation({
    mutationFn: (moduleId: string) => deleteCustomModule(moduleId),
    onSuccess: invalidate,
  });

  const addStat = useMutation({
    mutationFn: ({
      moduleId,
      label,
      unit,
      sortOrder,
    }: {
      moduleId: string;
      label: string;
      unit: string | null;
      sortOrder: number;
    }) => createCustomStat(moduleId, label, unit, sortOrder),
    onSuccess: invalidate,
  });

  const removeStat = useMutation({
    mutationFn: (statId: string) => deleteCustomStat(statId),
    onSuccess: invalidate,
  });

  const logValue = useMutation({
    mutationFn: ({
      statId,
      value,
      recordedOn,
    }: {
      statId: string;
      value: number;
      recordedOn: string;
    }) => logCustomStatValue(statId, value, recordedOn),
    onSuccess: invalidate,
  });

  const removeEntry = useMutation({
    mutationFn: (entryId: string) => deleteCustomStatEntry(entryId),
    onSuccess: invalidate,
  });

  return {
    addModule,
    renameModule,
    removeModule,
    addStat,
    removeStat,
    logValue,
    removeEntry,
  };
}
