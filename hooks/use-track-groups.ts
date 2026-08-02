"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearTrackGroupCover,
  createTrackGroup,
  deleteTrackGroup,
  fetchTrackGroups,
  reorderTrackGroups,
  setUngroupedSort,
  updateTrackGroup,
  uploadTrackGroupCover,
} from "@/lib/api/track-groups";
import type { Track, TrackGroup, TrackGroupAccent } from "@/lib/types";

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
      accentColor,
    }: {
      id: string;
      name?: string;
      sort?: number;
      accentColor?: TrackGroupAccent | null;
    }) => updateTrackGroup(id, { name, sort, accentColor }),
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

  const setCover = useMutation({
    mutationFn: ({ group, file }: { group: TrackGroup; file: File }) =>
      uploadTrackGroupCover(group, file),
    onSuccess: (group) => {
      qc.setQueryData<TrackGroup[]>(key, (prev) =>
        prev ? prev.map((g) => (g.id === group.id ? group : g)) : [group]
      );
    },
  });

  const clearCover = useMutation({
    mutationFn: (group: TrackGroup) => clearTrackGroupCover(group),
    onSuccess: (group) => {
      qc.setQueryData<TrackGroup[]>(key, (prev) =>
        prev ? prev.map((g) => (g.id === group.id ? group : g)) : [group]
      );
    },
  });

  /**
   * Reorder groups *and* the ungrouped run in one move.
   *
   * The ungrouped tracks have no row of their own, so their position lives on
   * the space. Writing both from a single renumbered list is what keeps the two
   * from drifting into an order that contradicts itself.
   */
  const reorderSections = useMutation({
    mutationFn: async ({
      groups,
      ungroupedSort,
    }: {
      groups: { id: string; sort: number }[];
      ungroupedSort: number;
    }) => {
      // The space write goes first because it is the one that fails when
      // migration 044 hasn't been run. Reordering the groups first would
      // persist half the move and then throw.
      if (spaceId) await setUngroupedSort(spaceId, ungroupedSort);
      await reorderTrackGroups(groups);
    },
    onMutate: async ({ groups, ungroupedSort }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TrackGroup[]>(key);
      if (prev) {
        const sortById = new Map(groups.map((o) => [o.id, o.sort]));
        qc.setQueryData<TrackGroup[]>(
          key,
          [...prev]
            .map((g) => (sortById.has(g.id) ? { ...g, sort: sortById.get(g.id)! } : g))
            .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
        );
      }
      // The space list is shared app-wide; patch the one field in place rather
      // than refetching every space on a drag.
      const spacesKeys = qc
        .getQueryCache()
        .findAll({ queryKey: ["spaces"] })
        .map((c) => c.queryKey);
      const prevSpaces = spacesKeys.map(
        (k) => [k, qc.getQueryData(k)] as const
      );
      spacesKeys.forEach((k) => {
        qc.setQueryData(k, (old: unknown) =>
          Array.isArray(old)
            ? old.map((s) =>
                s && typeof s === "object" && (s as { id?: string }).id === spaceId
                  ? { ...s, ungrouped_sort: ungroupedSort }
                  : s
              )
            : old
        );
      });
      return { prev, prevSpaces };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      ctx?.prevSpaces?.forEach(([k, v]) => qc.setQueryData(k, v));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["spaces"] });
    },
  });

  return { create, update, reorder, reorderSections, setCover, clearCover, remove };
}
