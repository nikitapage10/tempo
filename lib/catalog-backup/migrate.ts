import { CATALOG_SCHEMA_VERSION, emptyCatalogTables, type CatalogDump } from "@/lib/catalog-backup/types";

/**
 * Lift any supported dump to the current schema version.
 * v1 is the first published shape — later versions add migrate steps here.
 */
export function migrateCatalogDump(dump: CatalogDump): CatalogDump {
  let current = dump;

  if (current.schemaVersion > CATALOG_SCHEMA_VERSION) {
    throw new Error(
      `This catalog was exported with a newer TEMPO (schema ${current.schemaVersion}). Update the app, then try again.`,
    );
  }

  // Future: if (current.schemaVersion === 1) current = migrateV1toV2(current);

  if (current.schemaVersion !== CATALOG_SCHEMA_VERSION) {
    // Unknown gap — keep tables we understand, stamp current version, warn via notes.
    current = {
      ...current,
      schemaVersion: CATALOG_SCHEMA_VERSION,
      tables: {
        ...emptyCatalogTables(),
        ...current.tables,
      },
      notes: [
        ...current.notes,
        `Migrated from schema ${dump.schemaVersion} to ${CATALOG_SCHEMA_VERSION} with best-effort field mapping.`,
      ],
    };
  }

  return {
    ...current,
    schemaVersion: CATALOG_SCHEMA_VERSION,
    tables: {
      ...emptyCatalogTables(),
      ...current.tables,
    },
  };
}
