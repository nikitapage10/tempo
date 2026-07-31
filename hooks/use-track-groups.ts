"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTrackGroup,
  deleteTrackGroup,
  fetchTrackGroups,
  reorderTrackGroups,
  updateTrackGroup,
} from "@/lib/api/track-groups";
import type { Track, TrackGroup } from "@/lib/types";

export function useTrackGroups(spaceId: string | null) {
  return useQuery({
    queryKey: ["track-groups", spaceId],
    queryFn: () => fetchTrackGroups(spaceId!),
    enabled: !!spaceId,
  });
}

export function useTrackGroupMutations(spaceId: string | null) {
  const qc = useQueryClient();
  const key = ["track-groups", spaceId] as const;
  const tracksKey = ["tracks", spaceId] as const;

  const create = useMutation({
    mutationFn: (name: string) =>
      createTrackGroup({ spaceId: spaceId!, name }),
    onSuccess: (group) => {
      qc.setQueryData<TrackGroup[]>(key, (prev) =>
        prev ? [...prev, group] : [group]
      );
    },
  });

  const update = useMutation({
    mutationFn: ({
      id,
      name,
      sort,
    }: {
      id: string;
      name?: string;
      sort?: number;
    }) => updateTrackGroup(id, { name, sort }),
    onSuccess: (group) => {
      qc.setQueryData<TrackGroup[]>(key, (prev) =>
        prev ? prev.map((g) => (g.id === group.id ? group : g)) : [group]
      );
    },
  });

  const reorder = useMutation({
    mutationFn: (ordered: { id: string; sort: number }[]) =>
      reorderTrackGroups(ordered),
    onMutate: async (ordered) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TrackGroup[]>(key);
      if (prev) {
        const sortById = new Map(ordered.map((o) => [o.id, o.sort]));
        qc.setQueryData<TrackGroup[]>(
          key,
          [...prev]
            .map((g) =>
              sortById.has(g.id) ? { ...g, sort: sortById.get(g.id)! } : g
            )
            .sort(
              (a, b) => a.sort - b.sort || a.name.localeCompare(b.name)
            )
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTrackGroup(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      await qc.cancelQueries({ queryKey: tracksKey });
      const prevGroups = qc.getQueryData<TrackGroup[]>(key);
      const prevTracks = qc.getQueryData<Track[]>(tracksKey);
      if (prevGroups) {
        qc.setQueryData(
          key,
          prevGroups.filter((g) => g.id !== id)
        );
      }
      if (prevTracks) {
        qc.setQueryData<Track[]>(
          tracksKey,
          prevTracks.map((t) =>
            t.list_group_id === id ? { ...t, list_group_id: null } : t
          )
        );
      }
      return { prevGroups, prevTracks };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prevGroups) qc.setQueryData(key, ctx.prevGroups);
      if (ctx?.prevTracks) qc.setQueryData(tracksKey, ctx.prevTracks);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: tracksKey });
    },
  });

  return { create, update, reorder, remove };
}
