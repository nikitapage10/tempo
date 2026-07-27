"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useTemplates } from "@/hooks/use-templates";
import {
  applyRecipeActions,
  deriveRunStatus,
  recordRun,
  type RecipeActionResult,
} from "@/lib/api/recipes";
import { moveTrackStage } from "@/lib/api/tracks";
import { changeTrackStage } from "@/lib/stage-transition";
import { describeRecipeAction } from "@/lib/recipe-actions";
import type { StageRecipe, StageRecipeAction, Track } from "@/lib/types";

type RequestChangeOptions = {
  /** Track's stage before this change — enables the "safe" undo offer after automatic runs. */
  fromStageId?: string | null;
  trackTitle?: string;
};

type PendingPreview = {
  trackId: string;
  trackTitle: string;
  fromStageId: string | null;
  recipe: StageRecipe;
  transitionKey: string;
  selected: Set<number>;
};

/**
 * Centralizes "move a track to a new stage" across Board, the track stage
 * timeline, and any dropdown: writes the stage, loads that stage's recipe
 * (if enabled), then either shows a preview to apply/skip actions, or runs
 * them automatically with a toast + best-effort undo (FEATURE-SPECS §9).
 *
 * Mount `dialog` once near the root of whatever surface calls `changeStage`.
 */
export function useStageTransitionController(spaceId: string | null) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const templatesQuery = useTemplates();
  const templates = templatesQuery.data ?? [];

  const [preview, setPreview] = React.useState<PendingPreview | null>(null);
  const [busy, setBusy] = React.useState(false);

  function invalidateAfterMove(trackId: string) {
    qc.invalidateQueries({ queryKey: ["track", trackId] });
    qc.invalidateQueries({ queryKey: ["tracks", spaceId] });
    qc.invalidateQueries({ queryKey: ["today-stats"] });
  }

  function invalidateAfterRecipe(trackId: string) {
    qc.invalidateQueries({ queryKey: ["recipe-runs", trackId] });
    qc.invalidateQueries({ queryKey: ["checklist", trackId] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
    invalidateAfterMove(trackId);
  }

  async function runActions(
    trackId: string,
    recipe: StageRecipe,
    transitionKey: string,
    actions: StageRecipeAction[]
  ): Promise<RecipeActionResult[]> {
    const results = await applyRecipeActions(trackId, actions);
    await recordRun({
      recipeId: recipe.id,
      trackId,
      stageId: recipe.stage_id,
      transitionKey,
      status: deriveRunStatus(results),
      actionResults: results,
    });
    invalidateAfterRecipe(trackId);
    return results;
  }

  async function runAutomatic(
    trackId: string,
    recipe: StageRecipe,
    transitionKey: string,
    options: RequestChangeOptions
  ) {
    try {
      const results = await runActions(trackId, recipe, transitionKey, recipe.actions);
      const failed = results.filter((r) => r.status === "failed").length;
      const summary =
        failed > 0
          ? `Stage recipe ran with ${failed} issue${failed === 1 ? "" : "s"} — check recent automations.`
          : `Stage recipe ran automatically (${results.length} action${results.length === 1 ? "" : "s"}).`;

      const canUndo = options.fromStageId != null;
      toast(
        summary,
        failed > 0 ? "error" : "ok",
        canUndo
          ? {
              label: "Undo stage",
              onClick: () => void undoStageMove(trackId, options.fromStageId!),
            }
          : undefined
      );
    } catch (err) {
      toast(
        err instanceof Error
          ? err.message
          : "That stage recipe failed to run — the stage change itself still went through."
      );
    }
  }

  async function undoStageMove(trackId: string, toStageId: string) {
    try {
      await moveTrackStage(trackId, toStageId);
      invalidateAfterMove(trackId);
      toast(
        "Stage reverted. Note: checklist/task changes from the recipe weren't undone.",
        "info"
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t undo that stage change.");
    }
  }

  /** Moves the track, then previews/auto-runs its new stage's recipe. Returns the updated track. */
  async function changeStage(
    trackId: string,
    stageId: string,
    options: RequestChangeOptions = {}
  ): Promise<Track> {
    const result = await changeTrackStage({
      trackId,
      stageId,
      spaceId: spaceId ?? undefined,
    });
    invalidateAfterMove(trackId);

    if (result.recipe && result.recipe.actions.length > 0) {
      if (result.recipe.execution_mode === "automatic") {
        void runAutomatic(trackId, result.recipe, result.transitionKey, options);
      } else {
        setPreview({
          trackId,
          trackTitle: options.trackTitle ?? result.track.title,
          fromStageId: options.fromStageId ?? null,
          recipe: result.recipe,
          transitionKey: result.transitionKey,
          selected: new Set(result.recipe.actions.map((_, i) => i)),
        });
      }
    }
    return result.track;
  }

  function toggleSelected(index: number) {
    setPreview((p) => {
      if (!p) return p;
      const next = new Set(p.selected);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return { ...p, selected: next };
    });
  }

  async function applyPreview() {
    if (!preview) return;
    setBusy(true);
    try {
      const chosen = preview.recipe.actions.filter((_, i) => preview.selected.has(i));
      if (chosen.length === 0) {
        setPreview(null);
        return;
      }
      const results = await runActions(
        preview.trackId,
        preview.recipe,
        preview.transitionKey,
        chosen
      );
      const failed = results.filter((r) => r.status === "failed").length;
      toast(
        failed > 0
          ? `Applied with ${failed} issue${failed === 1 ? "" : "s"}.`
          : `Applied ${results.length} action${results.length === 1 ? "" : "s"}.`,
        failed > 0 ? "error" : "ok"
      );
      setPreview(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t apply those actions.");
    } finally {
      setBusy(false);
    }
  }

  function skipPreview() {
    setPreview(null);
  }

  const dialog = (
    <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
      {preview ? (
        <DialogContent
          title={`Stage recipe — ${preview.trackTitle}`}
          description="This stage has automations set up. Pick which ones to run now."
          onClose={() => setPreview(null)}
        >
          <ul className="space-y-2">
            {preview.recipe.actions.map((action, i) => (
              <li key={i}>
                <label className="flex items-start gap-2.5 rounded-input border border-line bg-bg-2/50 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-3.5 accent-[var(--ice)]"
                    checked={preview.selected.has(i)}
                    onChange={() => toggleSelected(i)}
                  />
                  <span className="text-text-hi">
                    {describeRecipeAction(action, templates)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={skipPreview} disabled={busy}>
              Skip all
            </Button>
            <Button type="button" onClick={() => void applyPreview()} disabled={busy}>
              {busy ? "Applying…" : "Apply selected"}
            </Button>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );

  return { changeStage, dialog, isChanging: busy };
}
