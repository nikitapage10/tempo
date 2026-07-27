"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSession,
  deleteSession,
  fetchSessions,
} from "@/lib/api/sessions";
import type { Session } from "@/lib/types";

export function useSessions(trackId: string | null) {
  return useQuery({
    queryKey: ["sessions", trackId],
    queryFn: () => fetchSessions(trackId!),
    enabled: !!trackId,
  });
}

export function useSessionMutations(trackId: string | null) {
  const qc = useQueryClient();
  const key = ["sessions", trackId] as const;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["today-stats"] });
  };

  const create = useMutation({
    mutationFn: (input: { note: string; versionId?: string | null }) =>
      createSession({
        trackId: trackId!,
        note: input.note,
        versionId: input.versionId,
      }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteSession(id),
    onSuccess: invalidate,
  });

  return { create, remove };
}
