import type { WorkPanelTabId } from "@/components/track/track-work-panel";
import type { WorkspacePreset } from "@/lib/types";

/**
 * Every movable section of the track workspace (FEATURE-SPECS §15).
 *
 * Before v0.13.1 only the four primary-column sections were movable and the
 * eight tools were locked into a sidebar tab bar. Now all of them are modules
 * that can live in either column, in any order.
 */
export type TrackModuleId =
  // primary sections
  | "player"
  | "versions"
  | "workflow"
  | "guestLinks"
  | "sessionLog"
  // tools (previously sidebar-only tabs)
  | "work"
  | "files"
  | "notes"
  | "comments"
  | "references"
  | "people"
  | "activity"
  | "details";

/**
 * The artist overview runs on this same layout engine with its own
 * vocabulary — a second set of module ids rather than a second implementation
 * of dragging, columns and the hidden tray.
 */
export type ArtistModuleId =
  | "output"
  | "pipeline"
  | "momentum"
  | "catalog"
  | "spaces"
  | "sound"
  | "rhythm"
  | "releases"
  | "lingering"
  | "feedback"
  | "spotify"
  | "soundcloud"
  | "apple";

export type ModuleId = TrackModuleId | ArtistModuleId;

export const MODULE_DEFS: { id: TrackModuleId; label: string }[] = [
  { id: "player", label: "Player & waveform" },
  { id: "versions", label: "Versions" },
  { id: "workflow", label: "Workflow (Now / Next / Blocked / Target)" },
  { id: "guestLinks", label: "Guest review links" },
  { id: "sessionLog", label: "Session log" },
  { id: "work", label: "Checklist" },
  { id: "comments", label: "Comments" },
  { id: "files", label: "Files" },
  { id: "notes", label: "Notes" },
  { id: "references", label: "References" },
  { id: "people", label: "People" },
  { id: "activity", label: "Activity" },
  { id: "details", label: "Details" },
];

export const ALL_MODULE_IDS: ModuleId[] = MODULE_DEFS.map((m) => m.id);

export const ARTIST_MODULE_DEFS: { id: ArtistModuleId; label: string }[] = [
  { id: "output", label: "The year in bounces" },
  { id: "pipeline", label: "Pipeline" },
  { id: "momentum", label: "Momentum" },
  { id: "catalog", label: "Catalog" },
  { id: "spaces", label: "Spaces" },
  { id: "sound", label: "Your sound" },
  { id: "rhythm", label: "Work rhythm" },
  { id: "releases", label: "Releases" },
  { id: "lingering", label: "Longest in progress" },
  { id: "feedback", label: "Feedback received" },
  { id: "spotify", label: "Spotify" },
  { id: "soundcloud", label: "SoundCloud" },
  { id: "apple", label: "Apple Music" },
];

export const ALL_ARTIST_MODULE_IDS: ModuleId[] = ARTIST_MODULE_DEFS.map(
  (m) => m.id
);

export function moduleLabel(id: ModuleId): string {
  return (
    MODULE_DEFS.find((m) => m.id === id)?.label ??
    ARTIST_MODULE_DEFS.find((m) => m.id === id)?.label ??
    id
  );
}

/** The waveform can never be hidden once a track has versions — FEATURE-SPECS §15.5. */
export const ALWAYS_VISIBLE_WITH_VERSIONS: ModuleId = "player";

export type ColumnId = "left" | "right";

/**
 * One position in a column. A slot holding several modules renders them as a
 * tabbed group — that's what dropping one module onto another produces.
 */
export type ModuleSlot = ModuleId[];

export type ModuleLayout = {
  left: ModuleSlot[];
  right: ModuleSlot[];
  /** Left column width as a percentage of the row. Clamped to LEFT_PCT_MIN..MAX. */
  leftPct?: number;
};

/** A slot's stable identity for drag-and-drop — its first module. */
export function slotId(slot: ModuleSlot): ModuleId {
  return slot[0];
}

export function flattenLayout(layout: ModuleLayout): ModuleId[] {
  return [...layout.left, ...layout.right].flat();
}

export const LEFT_PCT_MIN = 30;
export const LEFT_PCT_MAX = 78;
export const LEFT_PCT_DEFAULT = 60;

export function clampLeftPct(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return LEFT_PCT_DEFAULT;
  return Math.min(LEFT_PCT_MAX, Math.max(LEFT_PCT_MIN, Math.round(value)));
}

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
  layout: ModuleLayout;
  compactMode: boolean;
};

/**
 * Built-in layouts per preset.
 *
 * Each preset is a *focused* set, not a complete one — showing all 13 modules
 * turns one column into a dumping ground. Anything a preset leaves out stays
 * one click away in the "Hidden" tray of the layout editor, so nothing becomes
 * unreachable; it's just out of the way for that mode of working.
 */
export const PRESET_DEFAULTS: Record<WorkspacePreset, PresetShape> = {
  /** Capture ideas — notes sit beside the audio, admin stays grouped away. */
  writing: {
    layout: {
      left: [["player"], ["notes"]],
      right: [["workflow"], ["work", "references", "sessionLog"]],
      leftPct: 58,
    },
    compactMode: false,
  },

  /** Daily work — the listening surface leads; tools share one tabbed panel. */
  production: {
    layout: {
      left: [["player"], ["versions"]],
      right: [["workflow"], ["work", "comments", "sessionLog"]],
      leftPct: 60,
    },
    compactMode: false,
  },

  /** Respond to notes — comments get full height next to the waveform. */
  feedback: {
    layout: {
      left: [["player"], ["comments"]],
      right: [["work"], ["guestLinks", "people", "activity"]],
      leftPct: 64,
    },
    compactMode: false,
  },

  /** Compare bounces — versions dominate, everything else is one tab away. */
  mix_review: {
    layout: {
      left: [["player"], ["versions"]],
      right: [["comments", "references"], ["work"]],
      leftPct: 66,
    },
    compactMode: false,
  },

  /** Ship it — metadata and assets take over from the workbench. */
  release_prep: {
    layout: {
      left: [["player"], ["files"]],
      right: [["details", "people"], ["workflow", "work"]],
      leftPct: 55,
    },
    compactMode: false,
  },

  /** Placeholder for "the musician arranged it themselves". */
  custom: {
    layout: {
      left: [["player"], ["versions"]],
      right: [["workflow"], ["work", "comments", "sessionLog"]],
      leftPct: 60,
    },
    compactMode: false,
  },
};

export const DEFAULT_LAYOUT: ModuleLayout = PRESET_DEFAULTS.production.layout;

function isModuleId(value: unknown): value is ModuleId {
  return typeof value === "string" && (ALL_MODULE_IDS as string[]).includes(value);
}

/** Strips unknown/duplicate ids so a hand-edited or stale row can't break render. */
function sanitizeLayout(raw: unknown): ModuleLayout | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.left) && !Array.isArray(obj.right)) return null;

  // Accepts both shapes: the flat ["player","versions"] written before tab
  // groups existed, and the current [["player"],["work","comments"]].
  const seen = new Set<ModuleId>();
  const take = (arr: unknown): ModuleSlot[] => {
    if (!Array.isArray(arr)) return [];
    const out: ModuleSlot[] = [];
    for (const entry of arr) {
      const members = (Array.isArray(entry) ? entry : [entry]).filter(
        (v): v is ModuleId => isModuleId(v) && !seen.has(v)
      );
      for (const m of members) seen.add(m);
      if (members.length > 0) out.push(members);
    }
    return out;
  };

  return {
    left: take(obj.left),
    right: take(obj.right),
    leftPct: clampLeftPct(
      typeof obj.leftPct === "number" ? obj.leftPct : undefined
    ),
  };
}

/**
 * Legacy bridge: rows written before migration 012 only described the four
 * old primary modules plus a default sidebar tab. Reconstruct an equivalent
 * two-column layout so nobody's saved preference is silently discarded.
 */
function layoutFromLegacy(pref: {
  module_order: string[];
  hidden_modules: string[];
  default_panel: string | null;
}): ModuleLayout {
  const legacyPrimary: ModuleId[] = ["versions", "workflow", "guestLinks", "sessionLog"];
  const hidden = new Set(pref.hidden_modules);

  const ordered = pref.module_order.filter(
    (id): id is ModuleId => isModuleId(id) && legacyPrimary.includes(id)
  );
  const left: ModuleSlot[] = [
    "player" as ModuleId,
    ...ordered.filter((id) => !hidden.has(id)),
    ...legacyPrimary.filter((id) => !ordered.includes(id) && !hidden.has(id)),
  ].map((id) => [id]);

  // The old sidebar was itself a tab bar over these eight tools, so the exact
  // equivalent is one grouped slot — the musician sees what they had before,
  // and their chosen default tab leads.
  const tools: ModuleId[] = [
    "work",
    "comments",
    "files",
    "notes",
    "references",
    "people",
    "activity",
    "details",
  ];
  const preferred = isModuleId(pref.default_panel) ? pref.default_panel : null;
  const grouped =
    preferred && tools.includes(preferred)
      ? [preferred, ...tools.filter((t) => t !== preferred)]
      : tools;

  return { left, right: [grouped] };
}

/** Resolves a stored preference (or none) into a concrete, safe-to-render shape. */
export function effectivePresetShape(
  pref:
    | {
        preset: WorkspacePreset;
        module_order: string[];
        hidden_modules: string[];
        default_panel: string | null;
        compact_mode: boolean;
        module_layout?: unknown;
      }
    | null
): PresetShape {
  if (!pref) return PRESET_DEFAULTS.production;

  const stored = sanitizeLayout(pref.module_layout);
  const layout = stored ?? layoutFromLegacy(pref);

  return { layout, compactMode: pref.compact_mode };
}

/**
 * Turns an arbitrary stored blob (a saved template, a hand-edited row) into a
 * layout that is safe to render — unknown ids dropped, duplicates removed.
 */
export function layoutFromStored(raw: unknown): ModuleLayout {
  return sanitizeLayout(raw) ?? DEFAULT_LAYOUT;
}

/** Modules placed in neither column — available to add back. */
/** `vocabulary` lets a second surface (the artist overview) reuse this. */
export function hiddenModules(
  layout: ModuleLayout,
  vocabulary: ModuleId[] = ALL_MODULE_IDS
): ModuleId[] {
  const placed = new Set<ModuleId>(flattenLayout(layout));
  return vocabulary.filter((id) => !placed.has(id));
}

/** Default arrangement of the artist overview, before any personal edits. */
export const DEFAULT_ARTIST_LAYOUT: ModuleLayout = {
  left: [["output"], ["pipeline"], ["spaces"], ["sound"], ["lingering"]],
  right: [
    ["momentum"],
    ["catalog"],
    // Each platform stands on its own — they report different things (Spotify
    // followers, SoundCloud plays, Apple catalog), so tabbing them together
    // would hide two thirds of the picture behind a click. Drop one onto
    // another in Edit layout to group them if you'd rather.
    ["spotify"],
    ["soundcloud"],
    ["apple"],
    ["rhythm"],
    ["releases"],
    ["feedback"],
  ],
  leftPct: 60,
};
