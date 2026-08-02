import {
  CATALOG_FORMAT,
  CATALOG_TABLE_KEYS,
  emptyCatalogTables,
  type CatalogDetectResult,
  type CatalogDump,
  type CatalogTables,
} from "@/lib/catalog-backup/types";

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (row): row is Record<string, unknown> =>
      !!row && typeof row === "object" && !Array.isArray(row),
  );
}

/**
 * Detect whether arbitrary JSON is a TEMPO catalog dump.
 * Tolerates missing tables (fills empty arrays) so older/partial dumps still route
 * through the deterministic path when format + schemaVersion are present.
 */
export function detectCatalogDump(value: unknown): CatalogDetectResult {
  const obj = asObject(value);
  if (!obj) return { kind: "unknown" };
  if (obj.format !== CATALOG_FORMAT) return { kind: "unknown" };
  const schemaVersion = Number(obj.schemaVersion);
  if (!Number.isFinite(schemaVersion) || schemaVersion < 1) {
    return { kind: "unknown" };
  }

  const rawTables = asObject(obj.tables) ?? {};
  const tables = emptyCatalogTables();
  for (const key of CATALOG_TABLE_KEYS) {
    tables[key] = asRows(rawTables[key]);
  }

  const dump: CatalogDump = {
    format: CATALOG_FORMAT,
    schemaVersion,
    exportedAt:
      typeof obj.exportedAt === "string"
        ? obj.exportedAt
        : new Date().toISOString(),
    userId: typeof obj.userId === "string" ? obj.userId : "",
    appVersion: typeof obj.appVersion === "string" ? obj.appVersion : "",
    notes: Array.isArray(obj.notes)
      ? obj.notes.filter((n): n is string => typeof n === "string")
      : [],
    tables,
  };

  return { kind: "tempo-catalog", dump };
}

export async function parseCatalogJsonText(
  text: string,
): Promise<CatalogDetectResult> {
  try {
    return detectCatalogDump(JSON.parse(text) as unknown);
  } catch {
    return { kind: "unknown" };
  }
}

/** Loose check used by Import Studio before treating a .json as opaque notes. */
export function looksLikeTempoCatalog(value: unknown): boolean {
  const obj = asObject(value);
  return !!obj && obj.format === CATALOG_FORMAT;
}

export function summarizeTables(tables: CatalogTables): string {
  const parts: string[] = [];
  const interesting: (keyof CatalogTables)[] = [
    "artists",
    "spaces",
    "tracks",
    "projects",
    "tasks",
    "sessions",
    "calendar_events",
  ];
  for (const key of interesting) {
    const n = tables[key].length;
    if (n) parts.push(`${n} ${key.replace(/_/g, " ")}`);
  }
  return parts.length ? parts.join(", ") : "an empty catalog";
}
