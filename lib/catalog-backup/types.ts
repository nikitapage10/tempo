/**
 * Versioned TEMPO catalog dump — metadata only (no audio binaries).
 *
 * Bump CATALOG_SCHEMA_VERSION when the `tables` shape changes in a way that
 * older dumps need a migrate step. Keep migrate.ts able to lift every prior
 * version to the current one.
 */

export const CATALOG_FORMAT = "tempo-catalog" as const;
export const CATALOG_SCHEMA_VERSION = 1 as const;

/** Tables included in a v1 dump (export + restore unless noted). */
export const CATALOG_TABLE_KEYS = [
  "artists",
  "spaces",
  "stages",
  "projects",
  "track_groups",
  "tracks",
  "track_list_presets",
  "board_notes",
  "checklist_items",
  "templates",
  "tasks",
  "sessions",
  "track_references",
  "stage_recipes",
  "stage_recipe_runs",
  "release_details",
  "release_track_metadata",
  "calendar_events",
  "artist_origins",
  "people",
  /** Archival only — restored as metadata rows without guaranteeing audio exists. */
  "versions",
  "assets",
  "version_decisions",
] as const;

export type CatalogTableKey = (typeof CATALOG_TABLE_KEYS)[number];

export type CatalogRow = Record<string, unknown>;

export type CatalogTables = {
  [K in CatalogTableKey]: CatalogRow[];
};

export type CatalogDump = {
  format: typeof CATALOG_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  userId: string;
  appVersion: string;
  /** Human notes for the artist (e.g. audio not included). */
  notes: string[];
  tables: CatalogTables;
};

export type CatalogDetectResult =
  | { kind: "tempo-catalog"; dump: CatalogDump }
  | { kind: "unknown" };

export type CatalogRestoreMode = "merge";

export type CatalogRestoreSummary = {
  mode: CatalogRestoreMode;
  inserted: Partial<Record<CatalogTableKey, number>>;
  skipped: Partial<Record<CatalogTableKey, number>>;
  warnings: string[];
};

export type CatalogSnapshotMeta = {
  id: string;
  createdAt: string;
  schemaVersion: number;
  bytes: number;
  source: "nightly" | "manual";
  trackCount: number;
  projectCount: number;
  spaceCount: number;
};

export type CatalogSnapshotIndex = {
  userId: string;
  updatedAt: string;
  snapshots: CatalogSnapshotMeta[];
};

export function emptyCatalogTables(): CatalogTables {
  const tables = {} as CatalogTables;
  for (const key of CATALOG_TABLE_KEYS) tables[key] = [];
  return tables;
}
