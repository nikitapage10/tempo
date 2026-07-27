"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDecision,
  fetchDecisions,
  type CreateDecisionInput,
} from "@/lib/api/decisions";

export function useDecisions(trackId: string | null) {
  return useQuery({
    queryKey: ["decisions", trackId],
    queryFn: () => fetchDecisions(trackId!),
    enabled: !!trackId,
  });
}

export function useDecisionMutations(trackId: string | null) {
  const qc = useQueryClient();
  const key = ["decisions", trackId] as const;

  const create = useMutation({
    mutationFn: (input: Omit<CreateDecisionInput, "trackId">) =>
      createDecision({ ...input, trackId: trackId! }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { create };
}
