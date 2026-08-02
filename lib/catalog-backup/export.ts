import type { SupabaseClient } from "@supabase/supabase-js";
import { APP_VERSION } from "@/lib/version";
import {
  CATALOG_FORMAT,
  CATALOG_SCHEMA_VERSION,
  CATALOG_TABLE_KEYS,
  emptyCatalogTables,
  type CatalogDump,
  type CatalogRow,
  type CatalogTableKey,
  type CatalogTables,
} from "@/lib/catalog-backup/types";

type AnyClient = SupabaseClient;

const PAGE = 1000;

async function selectEq(
  client: AnyClient,
  table: string,
  column: string,
  value: string,
): Promise<CatalogRow[]> {
  const rows: CatalogRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .eq(column, value)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Couldn’t read ${table}: ${error.message}`);
    const batch = (data ?? []) as CatalogRow[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

async function selectIn(
  client: AnyClient,
  table: string,
  column: string,
  values: string[],
): Promise<CatalogRow[]> {
  if (!values.length) return [];
  const rows: CatalogRow[] = [];
  // Supabase `.in()` is fine for hundreds of ids; chunk to stay safe.
  const CHUNK = 200;
  for (let i = 0; i < values.length; i += CHUNK) {
    const slice = values.slice(i, i + CHUNK);
    let from = 0;
    for (;;) {
      const { data, error } = await client
        .from(table)
        .select("*")
        .in(column, slice)
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`Couldn’t read ${table}: ${error.message}`);
      const batch = (data ?? []) as CatalogRow[];
      rows.push(...batch);
      if (batch.length < PAGE) break;
      from += PAGE;
    }
  }
  return rows;
}

/**
 * Build a metadata-only catalog dump for one user.
 * Works with the user's session client (RLS) or the service-role client.
 */
export async function buildCatalogDump(
  client: AnyClient,
  userId: string,
): Promise<CatalogDump> {
  const tables = emptyCatalogTables();

  tables.artists = await selectEq(client, "artists", "user_id", userId);
  tables.spaces = await selectEq(client, "spaces", "user_id", userId);

  const spaceIds = tables.spaces.map((r) => String(r.id));
  tables.stages = await selectIn(client, "stages", "space_id", spaceIds);

  tables.projects = await selectEq(client, "projects", "user_id", userId);
  tables.track_groups = await selectEq(client, "track_groups", "user_id", userId);
  tables.tracks = await selectEq(client, "tracks", "user_id", userId);
  tables.track_list_presets = await selectEq(
    client,
    "track_list_presets",
    "user_id",
    userId,
  );
  tables.board_notes = await selectEq(client, "board_notes", "user_id", userId);
  tables.templates = await selectEq(client, "templates", "user_id", userId);
  tables.tasks = await selectEq(client, "tasks", "user_id", userId);
  tables.calendar_events = await selectEq(
    client,
    "calendar_events",
    "user_id",
    userId,
  );
  tables.artist_origins = await selectEq(
    client,
    "artist_origins",
    "user_id",
    userId,
  );
  tables.people = await selectEq(client, "people", "user_id", userId);

  const stageIds = tables.stages.map((r) => String(r.id));
  tables.stage_recipes = await selectIn(client, "stage_recipes", "stage_id", stageIds);

  const trackIds = tables.tracks.map((r) => String(r.id));
  tables.checklist_items = await selectIn(
    client,
    "checklist_items",
    "track_id",
    trackIds,
  );
  tables.sessions = await selectIn(client, "sessions", "track_id", trackIds);
  tables.track_references = await selectIn(
    client,
    "track_references",
    "track_id",
    trackIds,
  );
  tables.versions = await selectIn(client, "versions", "track_id", trackIds);
  tables.assets = await selectIn(client, "assets", "track_id", trackIds);
  tables.stage_recipe_runs = await selectIn(
    client,
    "stage_recipe_runs",
    "track_id",
    trackIds,
  );

  const versionIds = tables.versions.map((r) => String(r.id));
  tables.version_decisions = await selectIn(
    client,
    "version_decisions",
    "version_id",
    versionIds,
  );

  const projectIds = tables.projects.map((r) => String(r.id));
  tables.release_details = await selectIn(
    client,
    "release_details",
    "project_id",
    projectIds,
  );
  tables.release_track_metadata = await selectIn(
    client,
    "release_track_metadata",
    "project_id",
    projectIds,
  );

  return {
    format: CATALOG_FORMAT,
    schemaVersion: CATALOG_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    userId,
    appVersion: APP_VERSION,
    notes: [
      "This file is your TEMPO catalog metadata (tracks, notes, projects, tasks, calendar, and related text).",
      "Audio bounces and other uploaded files are not included — keep those in your DAW or archives.",
      "You can restore this file from Settings → Your data, or drop it into Import if the shape looks unfamiliar.",
    ],
    tables,
  };
}

export function catalogFilename(exportedAt = new Date()): string {
  const stamp = exportedAt
    .toISOString()
    .slice(0, 19)
    .replace(/[:T]/g, (c) => (c === "T" ? "_" : c === ":" ? "" : c));
  return `tempo-catalog-${stamp}.json`;
}

export function countCatalog(tables: CatalogTables): {
  trackCount: number;
  projectCount: number;
  spaceCount: number;
} {
  return {
    trackCount: tables.tracks.length,
    projectCount: tables.projects.length,
    spaceCount: tables.spaces.length,
  };
}

export { emptyCatalogTables } from "@/lib/catalog-backup/types";

export function isCatalogTableKey(key: string): key is CatalogTableKey {
  return (CATALOG_TABLE_KEYS as readonly string[]).includes(key);
}
