"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPerformance,
  deletePerformance,
  fetchPerformances,
  listCandidateCalendarShows,
  updatePerformance,
  type PerformanceInput,
} from "@/lib/api/performances";

export function usePerformances(artistId: string | null) {
  return useQuery({
    queryKey: ["performances", artistId],
    queryFn: () => fetchPerformances(artistId!),
    enabled: !!artistId,
    staleTime: 30_000,
  });
}

export function useCandidateCalendarShows(spaceIds: string[]) {
  return useQuery({
    queryKey: ["candidate-calendar-shows", ...spaceIds.slice().sort()],
    queryFn: () => listCandidateCalendarShows(spaceIds),
    enabled: spaceIds.length > 0,
    staleTime: 60_000,
  });
}

export function usePerformanceMutations(artistId: string | null) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["performances", artistId] });
    qc.invalidateQueries({ queryKey: ["artist-attribute-performances", artistId] });
    qc.invalidateQueries({ queryKey: ["achievement-awards", artistId] });
    qc.invalidateQueries({ queryKey: ["artist-point-events", artistId] });
  };

  const create = useMutation({
    mutationFn: (input: PerformanceInput) => createPerformance(artistId!, input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<PerformanceInput> }) =>
      updatePerformance(id, input),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deletePerformance(id),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
