"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTrack,
  deleteTrack,
  fetchTrack,
  fetchTracks,
  fetchVersionCount,
  moveTrackStage,
  updateTrack,
} from "@/lib/api/tracks";
import type { Track, TrackInsert, TrackUpdate } from "@/lib/types";

export function useTracks(spaceId: string | null) {
  return useQuery({
    queryKey: ["tracks", spaceId],
    queryFn: () => fetchTracks(spaceId!),
    enabled: !!spaceId,
  });
}

export function useTrack(trackId: string | null) {
  return useQuery({
    queryKey: ["track", trackId],
    queryFn: () => fetchTrack(trackId!),
    enabled: !!trackId,
  });
}

export function useVersionCount(trackId: string | null) {
  return useQuery({
    queryKey: ["version-count", trackId],
    queryFn: () => fetchVersionCount(trackId!),
    enabled: !!trackId,
  });
}

export function useTrackMutations(spaceId: string | null) {
  const qc = useQueryClient();
  const key = ["tracks", spaceId] as const;

  const invalidateLists = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["track"] });
  };

  const create = useMutation({
    mutationFn: (input: TrackInsert) => createTrack(input),
    onSuccess: invalidateLists,
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TrackUpdate }) =>
      updateTrack(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ["track", id] });
      const prev = qc.getQueryData<Track>(["track", id]);
      if (prev) {
        qc.setQueryData<Track>(["track", id], {
          ...prev,
          ...patch,
          updated_at: new Date().toISOString(),
        });
      }
      return { prev };
    },
    onError: (_e, { id }, ctx) => {
      if (ctx?.prev) qc.setQueryData(["track", id], ctx.prev);
    },
    onSuccess: (data) => {
      qc.setQueryData(["track", data.id], data);
      invalidateLists();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTrack(id),
    onSuccess: (_void, id) => {
      qc.removeQueries({ queryKey: ["track", id] });
      invalidateLists();
    },
  });

  const moveStage = useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string }) =>
      moveTrackStage(id, stageId),
    onMutate: async ({ id, stageId }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Track[]>(key);
      if (prev) {
        qc.setQueryData<Track[]>(
          key,
          prev.map((t) =>
            t.id === id
              ? { ...t, stage_id: stageId, updated_at: new Date().toISOString() }
              : t
          )
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: invalidateLists,
  });

  return { create, update, remove, moveStage };
}
