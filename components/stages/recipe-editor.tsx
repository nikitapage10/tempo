"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useRecipeMutations, useStageRecipe } from "@/hooks/use-recipes";
import { useTemplates } from "@/hooks/use-templates";
import {
  DECISION_AREAS,
  MOMENTUM_OPTIONS,
  SUGGESTED_RECIPE_STAGE_NAMES,
  TASK_CATEGORIES,
} from "@/lib/constants";
import {
  actionTypeLabel,
  defaultActionFor,
  describeRecipeAction,
  suggestedActionsForStage,
} from "@/lib/recipe-actions";
import type {
  DecisionArea,
  Momentum,
  RecipeExecutionMode,
  StageRecipeAction,
  TaskCategory,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type RecipeEditorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageId: string;
  stageName: string;
};

const ACTION_TYPES: StageRecipeAction["type"][] = [
  "apply_checklist_template",
  "create_task",
  "set_next_action",
  "set_momentum",
  "request_version_decision",
];

/**
 * Structured (no raw JSON) editor for a stage's automations — what runs when
 * a track moves into this stage, and whether it previews first or runs
 * automatically (FEATURE-SPECS §9).
 */
export function RecipeEditor({
  open,
  onOpenChange,
  stageId,
  stageName,
}: RecipeEditorProps) {
  const { data: recipe, isLoading } = useStageRecipe(open ? stageId : null);
  const { save } = useRecipeMutations(stageId);
  const templatesQuery = useTemplates(open);
  const templates = templatesQuery.data ?? [];
  const { toast } = useToast();

  const [enabled, setEnabled] = React.useState(true);
  const [mode, setMode] = React.useState<RecipeExecutionMode>("preview");
  const [actions, setActions] = React.useState<StageRecipeAction[]>([]);
  const [addType, setAddType] = React.useState<StageRecipeAction["type"]>(
    "create_task"
  );
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setEnabled(recipe?.enabled ?? true);
    setMode(recipe?.execution_mode ?? "preview");
    setActions(recipe?.actions ?? []);
  }, [open, recipe]);

  const isSuggestedStage = SUGGESTED_RECIPE_STAGE_NAMES.some(
    (n) => n === stageName.trim().toLowerCase()
  );

  function updateAction(index: number, next: StageRecipeAction) {
    setActions((prev) => prev.map((a, i) => (i === index ? next : a)));
  }

  function removeAction(index: number) {
    setActions((prev) => prev.filter((_, i) => i !== index));
  }

  function moveAction(index: number, dir: -1 | 1) {
    setActions((prev) => {
      const next = [...prev];
      const swap = index + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[index], next[swap]] = [next[swap], next[index]];
      return next;
    });
  }

  function addAction() {
    setActions((prev) => [...prev, defaultActionFor(addType)]);
  }

  function addSuggested() {
    const suggested = suggestedActionsForStage(stageName, templates);
    if (suggested.length === 0) {
      toast("No suggested recipe for this stage name yet.");
      return;
    }
    setActions((prev) => [...prev, ...suggested]);
    toast("Suggested actions added — review, then save.", "ok");
  }

  async function handleSave() {
    setBusy(true);
    try {
      await save.mutateAsync({
        enabled,
        executionMode: mode,
        actions,
      });
      toast("Recipe saved", "ok");
      onOpenChange(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t save that recipe.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Recipe — ${stageName}`}
        description="Automations that run when a track moves into this stage."
        onClose={() => onOpenChange(false)}
        className="max-w-xl"
      >
        {isLoading ? (
          <p className="text-sm text-text-lo">Loading…</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-input border border-line bg-bg-2/50 px-3 py-2.5">
              <label className="flex items-center gap-2 text-sm text-text-hi">
                <input
                  type="checkbox"
                  className="size-3.5 accent-[var(--ice)]"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                Enable recipe for this stage
              </label>
              <div className="flex items-center gap-1 rounded-input border border-line bg-bg-1 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setMode("preview")}
                  className={cn(
                    "rounded-input px-2.5 py-1 transition-colors duration-hover",
                    mode === "preview"
                      ? "bg-ice/15 text-ice"
                      : "text-text-lo hover:text-text-hi"
                  )}
                >
                  Preview first
                </button>
                <button
                  type="button"
                  onClick={() => setMode("automatic")}
                  className={cn(
                    "rounded-input px-2.5 py-1 transition-colors duration-hover",
                    mode === "automatic"
                      ? "bg-amber/15 text-amber"
                      : "text-text-lo hover:text-text-hi"
                  )}
                >
                  Automatic
                </button>
              </div>
            </div>

            {isSuggestedStage ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={addSuggested}
              >
                <Sparkles className="size-3.5" />
                Add suggested recipe for {stageName}
              </Button>
            ) : null}

            <ul className="space-y-2">
              {actions.map((action, i) => (
                <ActionRow
                  key={i}
                  action={action}
                  onChange={(next) => updateAction(i, next)}
                  onDelete={() => removeAction(i)}
                  onMoveUp={i > 0 ? () => moveAction(i, -1) : undefined}
                  onMoveDown={
                    i < actions.length - 1 ? () => moveAction(i, 1) : undefined
                  }
                />
              ))}
              {actions.length === 0 ? (
                <li className="rounded-input border border-dashed border-line px-3 py-4 text-center text-sm text-text-lo">
                  No actions yet. Add one below.
                </li>
              ) : null}
            </ul>

            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <select
                value={addType}
                onChange={(e) =>
                  setAddType(e.target.value as StageRecipeAction["type"])
                }
                className="h-8 rounded-input border border-line bg-bg-2 px-2 text-xs text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              >
                {ACTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {actionTypeLabel(t)}
                  </option>
                ))}
              </select>
              <Button type="button" size="sm" variant="secondary" onClick={addAction}>
                <Plus className="size-3.5" />
                Add action
              </Button>
            </div>

            <div className="flex justify-end gap-2 border-t border-line pt-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleSave} disabled={busy}>
                {busy ? "Saving…" : "Save recipe"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ActionRow({
  action,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  action: StageRecipeAction;
  onChange: (next: StageRecipeAction) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const templatesQuery = useTemplates();
  const templates = templatesQuery.data ?? [];

  return (
    <li className="rounded-card border border-line bg-bg-2/50 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
          {actionTypeLabel(action.type)}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Move up"
            disabled={!onMoveUp}
            onClick={onMoveUp}
            className="rounded-input p-1 text-text-lo transition-colors duration-hover hover:text-ice disabled:opacity-30"
          >
            <ArrowUp className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Move down"
            disabled={!onMoveDown}
            onClick={onMoveDown}
            className="rounded-input p-1 text-text-lo transition-colors duration-hover hover:text-ice disabled:opacity-30"
          >
            <ArrowDown className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Delete action"
            onClick={onDelete}
            className="rounded-input p-1 text-text-lo transition-colors duration-hover hover:text-warn"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {action.type === "apply_checklist_template" ? (
        <div>
          <Label htmlFor="tpl">Template</Label>
          <select
            id="tpl"
            value={action.template_id}
            onChange={(e) =>
              onChange({ ...action, template_id: e.target.value })
            }
            className="mt-1 flex h-9 w-full rounded-input border border-line bg-bg-1 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
          >
            <option value="">Pick a template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {action.type === "create_task" ? (
        <div className="space-y-2">
          <div>
            <Label htmlFor="task-title">Task title</Label>
            <Input
              id="task-title"
              value={action.title}
              onChange={(e) => onChange({ ...action, title: e.target.value })}
              placeholder="e.g. Confirm distributor upload"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="task-cat">Category</Label>
              <select
                id="task-cat"
                value={action.category ?? "other"}
                onChange={(e) =>
                  onChange({
                    ...action,
                    category: e.target.value as TaskCategory,
                  })
                }
                className="mt-1 flex h-9 w-full rounded-input border border-line bg-bg-1 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              >
                {TASK_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-28">
              <Label htmlFor="task-due">Due in (days)</Label>
              <Input
                id="task-due"
                type="number"
                min={0}
                value={action.due_offset_days ?? ""}
                onChange={(e) =>
                  onChange({
                    ...action,
                    due_offset_days:
                      e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
                placeholder="e.g. 7"
              />
            </div>
          </div>
        </div>
      ) : null}

      {action.type === "set_next_action" ? (
        <div>
          <Label htmlFor="next-action">Next move</Label>
          <Input
            id="next-action"
            value={action.next_action}
            onChange={(e) =>
              onChange({ ...action, next_action: e.target.value })
            }
            placeholder="e.g. Send mix for feedback"
          />
        </div>
      ) : null}

      {action.type === "set_momentum" ? (
        <div>
          <Label htmlFor="momentum">Momentum</Label>
          <select
            id="momentum"
            value={action.momentum}
            onChange={(e) =>
              onChange({ ...action, momentum: e.target.value as Momentum })
            }
            className="mt-1 flex h-9 w-full rounded-input border border-line bg-bg-1 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
          >
            {MOMENTUM_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {action.type === "request_version_decision" ? (
        <div className="space-y-2">
          <div>
            <Label htmlFor="decision-area">Decision area</Label>
            <select
              id="decision-area"
              value={action.decision_area ?? "general"}
              onChange={(e) =>
                onChange({
                  ...action,
                  decision_area: e.target.value as DecisionArea,
                })
              }
              className="mt-1 flex h-9 w-full rounded-input border border-line bg-bg-1 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            >
              {DECISION_AREAS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="decision-note">Note (optional)</Label>
            <Textarea
              id="decision-note"
              value={action.note ?? ""}
              onChange={(e) => onChange({ ...action, note: e.target.value })}
              rows={2}
              placeholder="What needs a call?"
            />
          </div>
        </div>
      ) : null}

      <p className="mt-2 text-xs text-text-lo">
        {describeRecipeAction(action, templates)}
      </p>
    </li>
  );
}
