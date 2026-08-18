"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTrack,
  deleteTrack,
  fetchTrack,
  fetchTracks,
  fetchVersionCount,
  moveTrackStage,
  reorderTracks,
  updateTrack,
} from "@/lib/api/tracks";
import type { Track, TrackInsert, TrackUpdate } from "@/lib/types";
import { warmSignedUrls } from "@/lib/storage";

export function useTracks(spaceId: string | null) {
  return useQuery({
    queryKey: ["tracks", spaceId],
    queryFn: async () => {
      const tracks = await fetchTracks(spaceId!);
      // Batch-sign covers as soon as the list lands so tiles don't wait
      // one-by-one on createSignedUrl.
      void warmSignedUrls(
        tracks
          .map((t) => t.artwork_url)
          .filter((url): url is string => !!url)
      );
      return tracks;
    },
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
    qc.invalidateQueries({ queryKey: ["calendar"] });
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
    mutationFn: ({ id, stageId }: { id: string; stageId: string | null }) =>
      moveTrackStage(id, stageId),
    onMutate: async ({ id, stageId }) => {
      const prev = qc.getQueryData<Track[]>(key);
      const next = prev?.map((t) =>
        t.id === id
          ? { ...t, stage_id: stageId, updated_at: new Date().toISOString() }
          : t
      );
      if (next) qc.setQueryData<Track[]>(key, next);
      await qc.cancelQueries({ queryKey: key });
      if (next) qc.setQueryData<Track[]>(key, next);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
  });

  const reorder = useMutation({
    mutationFn: (
      ordered: {
        id: string;
        list_sort: number;
        list_group_id?: string | null;
        stage_id?: string | null;
      }[]
    ) =>
      reorderTracks(
        ordered.map(({ id, list_sort, list_group_id }) => ({
          id,
          list_sort,
          ...(list_group_id !== undefined ? { list_group_id } : {}),
        }))
      ),
    onMutate: async (ordered) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Track[]>(key);
      const byId = new Map(
        ordered.map((o) => [
          o.id,
          {
            list_sort: o.list_sort,
            list_group_id: o.list_group_id,
            stage_id: o.stage_id,
          },
        ])
      );
      const next = prev
        ? prev
            .map((t) => {
              const patch = byId.get(t.id);
              if (!patch) return t;
              return {
                ...t,
                list_sort: patch.list_sort,
                ...(patch.list_group_id !== undefined
                  ? { list_group_id: patch.list_group_id }
                  : {}),
                ...(patch.stage_id !== undefined
                  ? {
                      stage_id: patch.stage_id,
                      updated_at: new Date().toISOString(),
                    }
                  : {}),
              };
            })
            .sort(
              (a, b) =>
                a.list_sort - b.list_sort || a.title.localeCompare(b.title)
            )
        : undefined;
      if (next) qc.setQueryData<Track[]>(key, next);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
  });

  return { create, update, remove, moveStage, reorder };
}
