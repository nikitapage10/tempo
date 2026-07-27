import { getRecipeByStage } from "@/lib/api/recipes";
import { moveTrackStage } from "@/lib/api/tracks";
import type { StageRecipe, Track } from "@/lib/types";

export type ChangeTrackStageInput = {
  trackId: string;
  stageId: string;
  /** Not used for the write itself — kept so callers can invalidate space-scoped caches. */
  spaceId?: string;
};

export type StageTransitionResult = {
  track: Track;
  recipe: StageRecipe | null;
  /** Unique per transition so a run can be recorded/looked-up without double-applying. */
  transitionKey: string;
};

/**
 * Moves a track to a new stage, then loads that stage's recipe (if any and
 * enabled) so the UI can preview or auto-run its actions. Does not execute
 * recipe actions itself — call applyRecipeActions/useRunRecipe with the
 * returned transitionKey once the musician confirms (or immediately, for
 * execution_mode "automatic").
 */
export async function changeTrackStage(
  input: ChangeTrackStageInput
): Promise<StageTransitionResult> {
  const track = await moveTrackStage(input.trackId, input.stageId);
  const recipeRow = await getRecipeByStage(input.stageId);
  const recipe = recipeRow && recipeRow.enabled ? recipeRow : null;
  const transitionKey = `${input.trackId}:${input.stageId}:${Date.now()}`;

  return { track, recipe, transitionKey };
}
