import { DECISION_AREAS, MOMENTUM_OPTIONS, TASK_CATEGORIES } from "@/lib/constants";
import type { ChecklistTemplate, StageRecipeAction } from "@/lib/types";

/** Human-readable label for an action's type, used in the "add action" picker. */
export function actionTypeLabel(type: StageRecipeAction["type"]): string {
  switch (type) {
    case "apply_checklist_template":
      return "Apply checklist template";
    case "create_task":
      return "Create task";
    case "set_next_action":
      return "Set next move";
    case "set_momentum":
      return "Set momentum";
    case "request_version_decision":
      return "Request a decision";
    default:
      return type;
  }
}

/** One-line plain-English summary of a configured action, for previews and logs. */
export function describeRecipeAction(
  action: StageRecipeAction,
  templates: ChecklistTemplate[]
): string {
  switch (action.type) {
    case "apply_checklist_template": {
      const t = templates.find((tpl) => tpl.id === action.template_id);
      return `Apply checklist template "${t?.name ?? "unknown template"}"`;
    }
    case "create_task": {
      const cat = TASK_CATEGORIES.find((c) => c.value === action.category)?.label;
      const due =
        action.due_offset_days != null
          ? ` (due in ${action.due_offset_days} day${action.due_offset_days === 1 ? "" : "s"})`
          : "";
      return `Create task "${action.title}"${cat ? ` · ${cat}` : ""}${due}`;
    }
    case "set_next_action":
      return `Set next move to "${action.next_action}"`;
    case "set_momentum": {
      const label =
        MOMENTUM_OPTIONS.find((m) => m.value === action.momentum)?.label ??
        action.momentum;
      return `Set momentum to ${label}`;
    }
    case "request_version_decision": {
      const area = DECISION_AREAS.find(
        (a) => a.value === action.decision_area
      )?.label;
      return `Request a decision${area ? ` on ${area}` : ""}`;
    }
    default:
      return "Unknown action";
  }
}

/** Default action shape for each type, used when the editor's "Add action" picker creates a new row. */
export function defaultActionFor(
  type: StageRecipeAction["type"]
): StageRecipeAction {
  switch (type) {
    case "apply_checklist_template":
      return { type, template_id: "" };
    case "create_task":
      return { type, title: "", category: "other" };
    case "set_next_action":
      return { type, next_action: "" };
    case "set_momentum":
      return { type, momentum: "active" };
    case "request_version_decision":
      return { type, decision_area: "general" };
  }
}

/** Starter recipes offered on Writing/Production/Mixdown/Master/Release Prep (FEATURE-SPECS §9). */
export function suggestedActionsForStage(
  stageName: string,
  templates: ChecklistTemplate[]
): StageRecipeAction[] {
  const name = stageName.trim().toLowerCase();
  const findTemplate = (label: string) =>
    templates.find((t) => t.name.toLowerCase() === label.toLowerCase());

  if (name === "writing") {
    const t = findTemplate("Arrangement");
    return [
      ...(t ? [{ type: "apply_checklist_template", template_id: t.id } as StageRecipeAction] : []),
      { type: "set_momentum", momentum: "active" },
    ];
  }
  if (name === "production") {
    return [
      { type: "create_task", title: "Rough bounce for feedback", category: "production", due_offset_days: 7 },
      { type: "set_momentum", momentum: "active" },
    ];
  }
  if (name === "mixdown") {
    const t = findTemplate("Mixdown");
    return [
      ...(t ? [{ type: "apply_checklist_template", template_id: t.id } as StageRecipeAction] : []),
      { type: "request_version_decision", decision_area: "mix" },
    ];
  }
  if (name === "master") {
    const t = findTemplate("Master Prep");
    return [
      ...(t ? [{ type: "apply_checklist_template", template_id: t.id } as StageRecipeAction] : []),
      { type: "request_version_decision", decision_area: "master" },
    ];
  }
  if (name === "release prep") {
    const t = findTemplate("Release Prep");
    return [
      ...(t ? [{ type: "apply_checklist_template", template_id: t.id } as StageRecipeAction] : []),
      { type: "create_task", title: "Confirm distributor upload", category: "admin", due_offset_days: 3 },
    ];
  }
  return [];
}
