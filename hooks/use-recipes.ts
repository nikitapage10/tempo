"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  applyRecipeActions,
  deriveRunStatus,
  getRecipeByStage,
  listEnabledRecipeStageIds,
  listRuns,
  recordRun,
  retryRun,
  upsertRecipe,
  type RecipeActionResult,
  type UpsertRecipeInput,
} from "@/lib/api/recipes";
import type { StageRecipeAction, StageRecipeRun, StageRecipeRunStatus } from "@/lib/types";

export function useStageRecipe(stageId: string | null) {
  return useQuery({
    queryKey: ["stage-recipe", stageId],
    queryFn: () => getRecipeByStage(stageId!),
    enabled: !!stageId,
  });
}

export function useRecipeRuns(trackId: string | null) {
  return useQuery({
    queryKey: ["recipe-runs", trackId],
    queryFn: () => listRuns(trackId!),
    enabled: !!trackId,
  });
}

/** Stage ids (within the given list) that currently have an enabled recipe — for a small timeline dot. */
export function useStagesWithRecipes(stageIds: string[]) {
  return useQuery({
    queryKey: ["stages-with-recipes", stageIds],
    queryFn: () => listEnabledRecipeStageIds(stageIds),
    enabled: stageIds.length > 0,
  });
}

export function useRecipeMutations(stageId: string | null) {
  const qc = useQueryClient();
  const key = ["stage-recipe", stageId] as const;

  const save = useMutation({
    mutationFn: (patch: UpsertRecipeInput) => upsertRecipe(stageId!, patch),
    onSuccess: (data) => qc.setQueryData(key, data),
  });

  return { save };
}

export type RunRecipeInput = {
  recipeId: string;
  trackId: string;
  stageId: string;
  transitionKey: string;
  actions: StageRecipeAction[];
  /** Persist a "pending" run before actions execute, useful for preview mode. */
  status?: StageRecipeRunStatus;
};

/** Runs a recipe's actions and records the outcome as a stage_recipe_run. */
export function useRunRecipe(trackId: string | null) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: RunRecipeInput) => {
      const results: RecipeActionResult[] = await applyRecipeActions(
        input.trackId,
        input.actions
      );
      const run = await recordRun({
        recipeId: input.recipeId,
        trackId: input.trackId,
        stageId: input.stageId,
        transitionKey: input.transitionKey,
        status: deriveRunStatus(results),
        actionResults: results,
      });
      return { run, results };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipe-runs", trackId] });
      qc.invalidateQueries({ queryKey: ["checklist", trackId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["track", trackId] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

/** Retries only the failed/skipped actions of a past run (FEATURE-SPECS §9). */
export function useRetryRecipeRun(trackId: string | null) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (run: StageRecipeRun) => retryRun(run, trackId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipe-runs", trackId] });
      qc.invalidateQueries({ queryKey: ["checklist", trackId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["track", trackId] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
