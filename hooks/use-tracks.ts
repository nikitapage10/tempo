"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTrack,
  deleteTrack,
  fetchTracks,
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

export function useTrackMutations(spaceId: string | null) {
  const qc = useQueryClient();
  const key = ["tracks", spaceId] as const;

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const create = useMutation({
    mutationFn: (input: TrackInsert) => createTrack(input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TrackUpdate }) =>
      updateTrack(id, patch),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTrack(id),
    onSuccess: invalidate,
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
    onSettled: invalidate,
  });

  return { create, update, remove, moveStage };
}
