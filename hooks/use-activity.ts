"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchActivity, logActivity, type LogActivityInput } from "@/lib/api/activity";

export function useActivity(trackId: string | null, limit = 50) {
  return useQuery({
    queryKey: ["activity", trackId, limit],
    queryFn: () => fetchActivity(trackId!, limit),
    enabled: !!trackId,
  });
}

export function useLogActivity(trackId: string | null) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<LogActivityInput, "trackId">) =>
      logActivity({ ...input, trackId: trackId! }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activity", trackId] }),
  });
}
