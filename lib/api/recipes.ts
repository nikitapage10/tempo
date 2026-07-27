import { createClient } from "@/lib/supabase/client";
import { applyTemplateToTrack } from "@/lib/api/checklist";
import { createTask } from "@/lib/api/tasks";
import { fetchTemplates } from "@/lib/api/templates";
import { updateTrack } from "@/lib/api/tracks";
import type {
  RecipeExecutionMode,
  StageRecipe,
  StageRecipeAction,
  StageRecipeRun,
  StageRecipeRunStatus,
} from "@/lib/types";

function normalizeRecipe(row: StageRecipe): StageRecipe {
  return {
    ...row,
    actions: Array.isArray(row.actions) ? row.actions : [],
  };
}

export async function getRecipeByStage(
  stageId: string
): Promise<StageRecipe | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stage_recipes")
    .select("*")
    .eq("stage_id", stageId)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeRecipe(data) : null;
}

export type UpsertRecipeInput = {
  enabled?: boolean;
  executionMode?: RecipeExecutionMode;
  actions?: StageRecipeAction[];
};

/** Create or update the one recipe a stage can have (stage_id is unique). */
export async function upsertRecipe(
  stageId: string,
  patch: UpsertRecipeInput
): Promise<StageRecipe> {
  const existing = await getRecipeByStage(stageId);
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stage_recipes")
    .upsert(
      {
        stage_id: stageId,
        enabled: patch.enabled ?? existing?.enabled ?? true,
        execution_mode:
          patch.executionMode ?? existing?.execution_mode ?? "preview",
        actions: patch.actions ?? existing?.actions ?? [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stage_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return normalizeRecipe(data);
}

/** Which of the given stages currently have an enabled recipe — feeds the small timeline indicator. */
export async function listEnabledRecipeStageIds(
  stageIds: string[]
): Promise<Set<string>> {
  if (stageIds.length === 0) return new Set();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stage_recipes")
    .select("stage_id")
    .in("stage_id", stageIds)
    .eq("enabled", true);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.stage_id as string));
}

export async function listRuns(trackId: string): Promise<StageRecipeRun[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stage_recipe_runs")
    .select("*")
    .eq("track_id", trackId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    action_results: Array.isArray(row.action_results) ? row.action_results : [],
  }));
}

export type RecordRunInput = {
  recipeId: string;
  trackId: string;
  stageId: string;
  transitionKey: string;
  status: StageRecipeRunStatus;
  actionResults: RecipeActionResult[];
};

/**
 * Upserts on transition_key so a "pending" run created for a preview can
 * later be updated in place once the musician confirms or edits it.
 */
export async function recordRun(input: RecordRunInput): Promise<StageRecipeRun> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stage_recipe_runs")
    .upsert(
      {
        recipe_id: input.recipeId,
        track_id: input.trackId,
        stage_id: input.stageId,
        transition_key: input.transitionKey,
        status: input.status,
        action_results: input.actionResults,
        completed_at:
          input.status === "pending" ? null : new Date().toISOString(),
      },
      { onConflict: "transition_key" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export type RecipeActionResult = {
  action: StageRecipeAction;
  status: "applied" | "skipped" | "failed";
  result?: unknown;
  error?: string;
};

function isRecipeActionResultArray(value: unknown): value is RecipeActionResult[] {
  return (
    Array.isArray(value) &&
    value.every(
      (r) =>
        r &&
        typeof r === "object" &&
        "action" in r &&
        "status" in r
    )
  );
}

/** Roll up a run's overall status from its per-action results. */
export function deriveRunStatus(
  results: RecipeActionResult[]
): StageRecipeRunStatus {
  if (results.length === 0) return "skipped";
  if (results.every((r) => r.status === "applied")) return "applied";
  if (results.every((r) => r.status === "failed")) return "failed";
  return "partial";
}

function offsetDateString(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Executes stage recipe actions sequentially against the existing
 * checklist/tasks/tracks APIs. Each action is isolated — one failure is
 * recorded and execution continues so the caller always gets a full
 * per-action report to show or log.
 */
export async function applyRecipeActions(
  trackId: string,
  actions: StageRecipeAction[]
): Promise<RecipeActionResult[]> {
  const results: RecipeActionResult[] = [];

  for (const action of actions) {
    try {
      switch (action.type) {
        case "apply_checklist_template": {
          const templates = await fetchTemplates();
          const template = templates.find((t) => t.id === action.template_id);
          if (!template) {
            throw new Error("That checklist template no longer exists.");
          }
          const items = await applyTemplateToTrack(trackId, template.items);
          results.push({
            action,
            status: "applied",
            result: { itemCount: items.length },
          });
          break;
        }
        case "create_task": {
          const task = await createTask({
            title: action.title,
            category: action.category ?? "other",
            due_date:
              action.due_offset_days != null
                ? offsetDateString(action.due_offset_days)
                : null,
            track_id: trackId,
          });
          results.push({ action, status: "applied", result: { taskId: task.id } });
          break;
        }
        case "set_next_action": {
          const track = await updateTrack(trackId, {
            next_action: action.next_action,
            next_action_due: action.next_action_due ?? null,
          });
          results.push({
            action,
            status: "applied",
            result: { nextAction: track.next_action },
          });
          break;
        }
        case "set_momentum": {
          const track = await updateTrack(trackId, { momentum: action.momentum });
          results.push({
            action,
            status: "applied",
            result: { momentum: track.momentum },
          });
          break;
        }
        case "request_version_decision": {
          const supabase = createClient();
          const { data: userData } = await supabase.auth.getUser();
          if (userData.user) {
            const { error } = await supabase.from("notifications").insert({
              user_id: userData.user.id,
              track_id: trackId,
              type: "decision_requested",
              title: "Decision requested",
              body:
                action.note?.trim() ||
                `A ${action.decision_area ?? "general"} decision is needed.`,
            });
            if (error) throw error;
          }
          results.push({ action, status: "applied" });
          break;
        }
        default: {
          results.push({ action, status: "skipped" });
        }
      }
    } catch (err) {
      results.push({
        action,
        status: "failed",
        error: err instanceof Error ? err.message : "That action failed.",
      });
    }
  }

  return results;
}

/**
 * Re-runs only the failed/skipped actions from a past run, merging results
 * back into the same run row so the log stays a single readable history
 * per transition (FEATURE-SPECS §9 — "retry only failed/unapplied").
 */
export async function retryRun(
  run: StageRecipeRun,
  trackId: string
): Promise<StageRecipeRun> {
  const priorResults = isRecipeActionResultArray(run.action_results)
    ? run.action_results
    : [];
  const toRetry = priorResults
    .filter((r) => r.status !== "applied")
    .map((r) => r.action);

  const retried = await applyRecipeActions(trackId, toRetry);
  const retriedByType = new Map<StageRecipeAction, RecipeActionResult>();
  toRetry.forEach((action, i) => retriedByType.set(action, retried[i]));

  const merged = priorResults.map((r) =>
    r.status === "applied" ? r : retriedByType.get(r.action) ?? r
  );

  const supabase = createClient();
  const { data, error } = await supabase
    .from("stage_recipe_runs")
    .update({
      status: deriveRunStatus(merged),
      action_results: merged,
      completed_at: new Date().toISOString(),
    })
    .eq("id", run.id)
    .select()
    .single();
  if (error) throw error;
  return {
    ...data,
    action_results: Array.isArray(data.action_results)
      ? data.action_results
      : [],
  };
}
