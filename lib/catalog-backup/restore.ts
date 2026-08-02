import type { SupabaseClient } from "@supabase/supabase-js";
import { migrateCatalogDump } from "@/lib/catalog-backup/migrate";
import {
  type CatalogDump,
  type CatalogRestoreMode,
  type CatalogRestoreSummary,
  type CatalogRow,
  type CatalogTableKey,
} from "@/lib/catalog-backup/types";

type AnyClient = SupabaseClient;

/** Insert order respects FKs. Versions/assets restored last (metadata only). */
const RESTORE_ORDER: CatalogTableKey[] = [
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
  "versions",
  "assets",
  "version_decisions",
];

const USER_ID_TABLES = new Set<CatalogTableKey>([
  "artists",
  "spaces",
  "projects",
  "track_groups",
  "tracks",
  "track_list_presets",
  "board_notes",
  "templates",
  "tasks",
  "sessions",
  "calendar_events",
  "artist_origins",
  "people",
]);

/** Columns we never write from a dump (DB-managed or unsafe). */
const STRIP_ALWAYS = new Set<string>([]);

function stripRow(
  table: CatalogTableKey,
  row: CatalogRow,
  userId: string,
): CatalogRow | null {
  const id = row.id;
  if (table !== "release_details" && table !== "artist_origins") {
    if (typeof id !== "string" || !id) return null;
  }

  const next: CatalogRow = { ...row };

  for (const key of Array.from(STRIP_ALWAYS)) {
    delete next[key];
  }

  if (USER_ID_TABLES.has(table)) {
    next.user_id = userId;
  }

  // Sessions: keep version_id if present; broken links become harmless nulls via FK SET NULL on delete,
  // but a missing version id on insert will fail — clear unknown/empty.
  if (table === "sessions") {
    if (next.version_id != null && typeof next.version_id !== "string") {
      next.version_id = null;
    }
  }

  // Versions: let the DB assign version_no via trigger; keep label/changelog/paths.
  if (table === "versions") {
    delete next.version_no;
  }

  return next;
}

async function existingIds(
  client: AnyClient,
  table: CatalogTableKey,
  ids: string[],
): Promise<Set<string>> {
  const found = new Set<string>();
  if (!ids.length) return found;
  const CHUNK = 200;
  const idColumn =
    table === "release_details"
      ? "project_id"
      : table === "artist_origins"
        ? "artist_id"
        : "id";

  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { data, error } = await client
      .from(table)
      .select(idColumn)
      .in(idColumn, slice);
    if (error) throw new Error(`Couldn’t check ${table}: ${error.message}`);
    for (const row of data ?? []) {
      const v = (row as CatalogRow)[idColumn];
      if (typeof v === "string") found.add(v);
    }
  }
  return found;
}

function rowKey(table: CatalogTableKey, row: CatalogRow): string | null {
  if (table === "release_details") {
    return typeof row.project_id === "string" ? row.project_id : null;
  }
  if (table === "artist_origins") {
    return typeof row.artist_id === "string" ? row.artist_id : null;
  }
  return typeof row.id === "string" ? row.id : null;
}

/**
 * Merge a catalog dump into the signed-in user's workspace.
 * Existing rows (same primary key) are left alone — nothing is deleted.
 */
export async function restoreCatalogDump(
  client: AnyClient,
  userId: string,
  rawDump: CatalogDump,
  mode: CatalogRestoreMode = "merge",
): Promise<CatalogRestoreSummary> {
  const dump = migrateCatalogDump(rawDump);
  const inserted: Partial<Record<CatalogTableKey, number>> = {};
  const skipped: Partial<Record<CatalogTableKey, number>> = {};
  const warnings: string[] = [
    ...dump.notes.filter((n) => n.toLowerCase().includes("audio")),
  ];

  if (dump.userId && dump.userId !== userId) {
    warnings.push(
      "This file was exported from a different account — rows will be owned by you after restore.",
    );
  }

  for (const table of RESTORE_ORDER) {
    const rawRows = dump.tables[table] ?? [];
    if (!rawRows.length) continue;

    const prepared: CatalogRow[] = [];
    for (const row of rawRows) {
      const cleaned = stripRow(table, row, userId);
      if (cleaned) prepared.push(cleaned);
    }

    const keys = prepared
      .map((r) => rowKey(table, r))
      .filter((k): k is string => !!k);
    const already = await existingIds(client, table, keys);

    const toInsert = prepared.filter((r) => {
      const k = rowKey(table, r);
      return k != null && !already.has(k);
    });
    const skipCount = prepared.length - toInsert.length;
    if (skipCount) skipped[table] = (skipped[table] ?? 0) + skipCount;

    if (!toInsert.length) continue;

    // Insert in modest batches.
    const BATCH = 100;
    let ok = 0;
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const batch = toInsert.slice(i, i + BATCH);
      const { error } = await client.from(table).insert(batch);
      if (error) {
        // Soft-fail one table so a partial restore still lands the rest.
        warnings.push(`Couldn’t restore ${table}: ${error.message}`);
        console.error(`[catalog-restore] ${table}:`, error.message);
        break;
      }
      ok += batch.length;
    }
    if (ok) inserted[table] = (inserted[table] ?? 0) + ok;
  }

  if ((inserted.versions ?? 0) > 0 || (dump.tables.versions?.length ?? 0) > 0) {
    warnings.push(
      "Version and asset rows were restored as metadata only. Audio files themselves are not in this backup — re-upload bounces if playback is missing.",
    );
  }

  return { mode, inserted, skipped, warnings };
}
