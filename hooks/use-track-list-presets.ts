"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTrackListPreset,
  deleteTrackListPreset,
  fetchTrackListPresets,
  updateTrackListPreset,
} from "@/lib/api/track-list-presets";
import type { TrackListPreset } from "@/lib/types";

export function useTrackListPresets(spaceId: string | null) {
  return useQuery({
    queryKey: ["track-list-presets", spaceId],
    queryFn: () => fetchTrackListPresets(spaceId!),
    enabled: !!spaceId,
  });
}

export function useTrackListPresetMutations(spaceId: string | null) {
  const qc = useQueryClient();
  const key = ["track-list-presets", spaceId] as const;

  const create = useMutation({
    mutationFn: (input: { name: string; trackIds: string[] }) =>
      createTrackListPreset({
        spaceId: spaceId!,
        name: input.name,
        trackIds: input.trackIds,
      }),
    onSuccess: (preset) => {
      qc.setQueryData<TrackListPreset[]>(key, (prev) =>
        prev ? [...prev, preset] : [preset]
      );
    },
  });

  const update = useMutation({
    mutationFn: ({
      id,
      name,
      trackIds,
    }: {
      id: string;
      name?: string;
      trackIds?: string[];
    }) => updateTrackListPreset(id, { name, trackIds }),
    onSuccess: (preset) => {
      qc.setQueryData<TrackListPreset[]>(key, (prev) =>
        prev
          ? prev.map((p) => (p.id === preset.id ? preset : p))
          : [preset]
      );
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTrackListPreset(id),
    onSuccess: (_void, id) => {
      qc.setQueryData<TrackListPreset[]>(key, (prev) =>
        prev ? prev.filter((p) => p.id !== id) : []
      );
    },
  });

  return { create, update, remove };
}
