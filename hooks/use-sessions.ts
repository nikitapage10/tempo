"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  abandonSession,
  createSession,
  deleteSession,
  endFocusSession,
  fetchActiveSession,
  fetchSessions,
  startFocusSession,
  weeklyElapsed,
  type EndFocusSessionInput,
  type StartFocusSessionInput,
} from "@/lib/api/sessions";

export function useSessions(trackId: string | null) {
  return useQuery({
    queryKey: ["sessions", trackId],
    queryFn: () => fetchSessions(trackId!),
    enabled: !!trackId,
  });
}

/** The signed-in user's in-progress focus session, if any. */
export function useActiveSession() {
  return useQuery({
    queryKey: ["active-session"],
    queryFn: fetchActiveSession,
  });
}

export function useWeeklyElapsed() {
  return useQuery({
    queryKey: ["weekly-elapsed"],
    queryFn: weeklyElapsed,
  });
}

export function useSessionMutations(trackId: string | null) {
  const qc = useQueryClient();
  const key = ["sessions", trackId] as const;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["today-stats"] });
    qc.invalidateQueries({ queryKey: ["active-session"] });
    qc.invalidateQueries({ queryKey: ["weekly-elapsed"] });
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

  const startFocus = useMutation({
    mutationFn: (input: Omit<StartFocusSessionInput, "trackId">) =>
      startFocusSession({ ...input, trackId: trackId! }),
    onSuccess: invalidate,
  });

  const endFocus = useMutation({
    mutationFn: ({
      sessionId,
      input,
    }: {
      sessionId: string;
      input: EndFocusSessionInput;
    }) => endFocusSession(sessionId, input),
    onSuccess: invalidate,
  });

  const abandonFocus = useMutation({
    mutationFn: (sessionId: string) => abandonSession(sessionId),
    onSuccess: invalidate,
  });

  return { create, remove, startFocus, endFocus, abandonFocus };
}
