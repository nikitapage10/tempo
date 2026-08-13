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
  | "spaces"
  | "sound"
  | "rhythm"
  | "releases"
  | "lingering"
  // Replaces the old separate "catalog" + "feedback" modules — each was a
  // handful of MetaRows on its own full panel; merged into one compact one.
  | "signals"
  | "spotify"
  | "soundcloud"
  | "apple"
  // Gamification (stream 2): the radar + rows, the trophy shelf, and the
  // performance log that feeds Stage Presence.
  | "attributes"
  | "achievements"
  | "live"
  // A hand-built module, one per row in artist_custom_modules — the id
  // vocabulary is per-artist and only known at runtime, so it can't be a
  // fixed literal like the ids above.
  | `custom:${string}`;

export type ModuleId = TrackModuleId | ArtistModuleId;

export function customModuleDbId(id: ModuleId): string | null {
  return id.startsWith("custom:") ? id.slice("custom:".length) : null;
}

export function customModuleId(dbId: string): ArtistModuleId {
  return `custom:${dbId}`;
}

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

/**
 * A rendering hint, not a layout constraint — modules of any tier can still be
 * dragged anywhere. `feature` gets full-bleed prominence (the attribute sheet
 * lives here once it exists; until then `output` borrows the slot), `compact`
 * gets reduced padding and no full section header, `standard` is everything
 * else. This is what turns the default arrangement into a hierarchy instead
 * of a flat wall of identical panels.
 */
export type ArtistModuleTier = "feature" | "standard" | "compact";

export const ARTIST_MODULE_DEFS: {
  id: ArtistModuleId;
  label: string;
  tier: ArtistModuleTier;
}[] = [
  { id: "output", label: "The year in bounces", tier: "feature" },
  { id: "pipeline", label: "Pipeline", tier: "standard" },
  { id: "momentum", label: "Momentum", tier: "compact" },
  { id: "spaces", label: "Spaces", tier: "standard" },
  { id: "sound", label: "Your sound", tier: "standard" },
  { id: "rhythm", label: "Work rhythm", tier: "standard" },
  { id: "releases", label: "Releases", tier: "standard" },
  { id: "lingering", label: "Longest in progress", tier: "standard" },
  { id: "signals", label: "Signals", tier: "compact" },
  { id: "spotify", label: "Spotify", tier: "standard" },
  { id: "soundcloud", label: "SoundCloud", tier: "standard" },
  { id: "apple", label: "Apple Music", tier: "standard" },
  { id: "attributes", label: "Artist attributes", tier: "feature" },
  { id: "achievements", label: "Achievements", tier: "standard" },
  { id: "live", label: "Live", tier: "standard" },
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

/** Defaults to "standard" for track modules and anything unrecognised (e.g. custom modules). */
export function moduleTier(id: ModuleId): ArtistModuleTier {
  return ARTIST_MODULE_DEFS.find((m) => m.id === id)?.tier ?? "standard";
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

/**
 * Default arrangement of the artist overview, before any personal edits.
 *
 * A narrative, not an inventory: the attribute sheet leads as the page's one
 * feature module, the left column is the work (what's been made and what's
 * in flight), the right column is everything else — grouped rather than
 * stacked where it's naturally one story told three ways (the platforms),
 * and the small stuff consolidated into one compact "Signals" module instead
 * of two near-empty panels.
 */
export const DEFAULT_ARTIST_LAYOUT: ModuleLayout = {
  left: [
    ["attributes"],
    ["output"],
    ["pipeline"],
    ["spaces"],
    ["sound"],
    ["lingering"],
  ],
  right: [
    // Spotify, SoundCloud and Apple each report a different number, but
    // they're the same *kind* of thing — connected-platform reach — so
    // unlike the old one-panel-each layout, they lead as a single tabbed
    // group here. Split them apart in Edit layout if you'd rather.
    ["spotify", "soundcloud", "apple"],
    ["momentum"],
    ["achievements"],
    ["live"],
    ["rhythm"],
    ["releases"],
    ["signals"],
  ],
  leftPct: 60,
};

export type ArtistLayoutTemplateId = "overview" | "minimal" | "stats" | "platforms";

export type ArtistLayoutTemplate = {
  id: ArtistLayoutTemplateId;
  label: string;
  /** One line shown under the label in the template picker. */
  description: string;
  layout: ModuleLayout;
};

/**
 * Starting points offered in "Edit layout" for the artist overview.
 *
 * Each is a *focused* set, not a complete one, same reasoning as
 * PRESET_DEFAULTS above. Anything a template leaves out isn't gone — it just
 * isn't placed, so it shows up in the "Hidden" tray of the layout editor,
 * one click from being added back or dropped into either column.
 */
export const ARTIST_LAYOUT_TEMPLATES: ArtistLayoutTemplate[] = [
  {
    id: "overview",
    label: "Overview",
    description: "Everything, all at once — the default arrangement.",
    layout: DEFAULT_ARTIST_LAYOUT,
  },
  {
    id: "minimal",
    label: "Minimal",
    description: "Just the shape of things: output, spaces, signals.",
    layout: {
      left: [["output"], ["spaces"]],
      right: [["signals"], ["releases"]],
      leftPct: 60,
    },
  },
  {
    id: "stats",
    label: "Statistics",
    description: "Numbers first — momentum, pipeline, rhythm, sound.",
    layout: {
      left: [["momentum"], ["pipeline"], ["output"]],
      right: [["rhythm"], ["sound"], ["signals"]],
      leftPct: 55,
    },
  },
  {
    id: "platforms",
    label: "Platforms",
    description: "Spotify, SoundCloud and Apple Music lead the page.",
    layout: {
      left: [["spotify"], ["soundcloud"], ["apple"]],
      right: [["output"], ["signals"], ["spaces"]],
      leftPct: 55,
    },
  },
];
