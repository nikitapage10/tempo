import type { WorkPanelTabId } from "@/components/track/track-work-panel";
import type { WorkspacePreset } from "@/lib/types";

/** Primary-column sections a musician can reorder/hide (FEATURE-SPECS §15). */
export type ModuleId = "versions" | "workflow" | "guestLinks" | "sessionLog";

export const MODULE_DEFS: { id: ModuleId; label: string }[] = [
  { id: "versions", label: "Versions & waveform" },
  { id: "workflow", label: "Workflow (Now / Next / Blocked / Target)" },
  { id: "guestLinks", label: "Guest review links" },
  { id: "sessionLog", label: "Session log" },
];

export const ALL_MODULE_IDS: ModuleId[] = MODULE_DEFS.map((m) => m.id);

/** Waveform/versions can never be hidden once a track has versions — FEATURE-SPECS §15.5. */
export const ALWAYS_VISIBLE_WITH_VERSIONS: ModuleId = "versions";

export type PanelTabOption = { value: WorkPanelTabId; label: string };

export const DEFAULT_PANEL_OPTIONS: PanelTabOption[] = [
  { value: "work", label: "Work (checklist)" },
  { value: "files", label: "Files" },
  { value: "notes", label: "Notes" },
  { value: "comments", label: "Comments" },
  { value: "references", label: "References" },
  { value: "people", label: "People" },
  { value: "activity", label: "Activity" },
  { value: "details", label: "Details" },
];

export type PresetShape = {
  moduleOrder: ModuleId[];
  hiddenModules: ModuleId[];
  defaultPanel: WorkPanelTabId;
  compactMode: boolean;
};

/**
 * Built-in defaults per preset (FEATURE-SPECS §15). "production" is the
 * fallback used when a musician has never customized anything at all —
 * precedence is track > stage > global > this built-in default.
 */
export const PRESET_DEFAULTS: Record<WorkspacePreset, PresetShape> = {
  writing: {
    moduleOrder: ["workflow", "sessionLog", "versions", "guestLinks"],
    hiddenModules: ["guestLinks"],
    defaultPanel: "notes",
    compactMode: false,
  },
  production: {
    moduleOrder: ["versions", "workflow", "guestLinks", "sessionLog"],
    hiddenModules: [],
    defaultPanel: "work",
    compactMode: false,
  },
  feedback: {
    moduleOrder: ["versions", "workflow", "guestLinks", "sessionLog"],
    hiddenModules: ["sessionLog"],
    defaultPanel: "comments",
    compactMode: false,
  },
  mix_review: {
    moduleOrder: ["versions", "guestLinks", "workflow", "sessionLog"],
    hiddenModules: ["sessionLog"],
    defaultPanel: "comments",
    compactMode: false,
  },
  release_prep: {
    moduleOrder: ["workflow", "versions", "guestLinks", "sessionLog"],
    hiddenModules: [],
    defaultPanel: "files",
    compactMode: false,
  },
  custom: {
    moduleOrder: ["versions", "workflow", "guestLinks", "sessionLog"],
    hiddenModules: [],
    defaultPanel: "work",
    compactMode: false,
  },
};

function isModuleId(value: string): value is ModuleId {
  return (ALL_MODULE_IDS as string[]).includes(value);
}

function isPanelTabId(value: string): value is WorkPanelTabId {
  return DEFAULT_PANEL_OPTIONS.some((o) => o.value === value);
}

/** Resolves a stored preference (or none) into a concrete, safe-to-render shape. */
export function effectivePresetShape(pref: {
  preset: WorkspacePreset;
  module_order: string[];
  hidden_modules: string[];
  default_panel: string | null;
  compact_mode: boolean;
} | null): PresetShape {
  const fallback = PRESET_DEFAULTS.production;
  if (!pref) return fallback;

  const storedOrder = pref.module_order.filter(isModuleId);
  const moduleOrder =
    storedOrder.length > 0
      ? [...storedOrder, ...ALL_MODULE_IDS.filter((id) => !storedOrder.includes(id))]
      : fallback.moduleOrder;

  return {
    moduleOrder,
    hiddenModules: pref.hidden_modules.filter(isModuleId),
    defaultPanel:
      pref.default_panel && isPanelTabId(pref.default_panel)
        ? pref.default_panel
        : fallback.defaultPanel,
    compactMode: pref.compact_mode,
  };
}
