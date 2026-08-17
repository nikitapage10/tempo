"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProWorkflow,
  createProWorkflowCard,
  createProWorkflowStage,
  deleteProWorkflow,
  deleteProWorkflowCard,
  deleteProWorkflowStage,
  fetchProWorkflowBundle,
  installProWorkflowSeeds,
  updateProWorkflow,
  updateProWorkflowCard,
  updateProWorkflowStage,
} from "@/lib/api/pro-workflows";
import type { ProWorkflowBundle, ProWorkflowSeed } from "@/lib/pro-workflows/types";

export function useProWorkflows(spaceId: string | null) {
  return useQuery({
    queryKey: ["pro-workflows", spaceId],
    queryFn: () => fetchProWorkflowBundle(spaceId!),
    enabled: Boolean(spaceId),
  });
}

export function useProWorkflowMutations(spaceId: string | null) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["pro-workflows", spaceId] });
  return {
    installSeeds: useMutation({
      mutationFn: (seeds: ProWorkflowSeed[]) => installProWorkflowSeeds(spaceId!, seeds),
      onSuccess: invalidate,
    }),
    createWorkflow: useMutation({
      mutationFn: (input: { name: string; description?: string | null }) => createProWorkflow(spaceId!, input),
      onSuccess: invalidate,
    }),
    updateWorkflow: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateProWorkflow>[1] }) => updateProWorkflow(id, patch),
      onSuccess: invalidate,
    }),
    deleteWorkflow: useMutation({ mutationFn: deleteProWorkflow, onSuccess: invalidate }),
    createStage: useMutation({
      mutationFn: ({ workflowId, input }: { workflowId: string; input: Parameters<typeof createProWorkflowStage>[1] }) => createProWorkflowStage(workflowId, input),
      onSuccess: invalidate,
    }),
    updateStage: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateProWorkflowStage>[1] }) => updateProWorkflowStage(id, patch),
      onSuccess: invalidate,
    }),
    deleteStage: useMutation({
      mutationFn: ({ stageId, moveCardsToStageId }: { stageId: string; moveCardsToStageId: string }) => deleteProWorkflowStage(stageId, moveCardsToStageId),
      onSuccess: invalidate,
    }),
    createCard: useMutation({ mutationFn: createProWorkflowCard, onSuccess: invalidate }),
    updateCard: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateProWorkflowCard>[1] }) => updateProWorkflowCard(id, patch),
      onMutate: async ({ id, patch }) => {
        const key = ["pro-workflows", spaceId] as const;
        await queryClient.cancelQueries({ queryKey: key });
        const prev = queryClient.getQueryData<ProWorkflowBundle>(key);
        if (prev) {
          queryClient.setQueryData<ProWorkflowBundle>(key, {
            ...prev,
            workflows: prev.workflows.map((workflow) => ({
              ...workflow,
              cards: workflow.cards.map((card) =>
                card.id === id
                  ? { ...card, ...patch, updatedAt: new Date().toISOString() }
                  : card
              ),
            })),
          });
        }
        return { prev };
      },
      onError: (_error, _vars, context) => {
        if (context?.prev) {
          queryClient.setQueryData(["pro-workflows", spaceId], context.prev);
        }
      },
      onSettled: invalidate,
    }),
    deleteCard: useMutation({ mutationFn: deleteProWorkflowCard, onSuccess: invalidate }),
  };
}
