/**
 * LLM normalizer for partial / stale / oddly-shaped catalog JSON.
 * SERVER ONLY — uses the same OpenAI client as Import Studio.
 *
 * Used when a file is JSON but isn't a clean tempo-catalog dump.
 * Never the primary path for a valid v1 dump.
 */

import {
  IMPORT_MODEL,
  createOpenAIClient,
  friendlyAIError,
} from "@/lib/ai/openai";
import { detectCatalogDump } from "@/lib/catalog-backup/detect";
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

function asRows(value: unknown): CatalogRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (row): row is CatalogRow =>
      !!row && typeof row === "object" && !Array.isArray(row),
  );
}

function coerceTables(raw: unknown): CatalogTables {
  const tables = emptyCatalogTables();
  if (!raw || typeof raw !== "object") return tables;
  const obj = raw as Record<string, unknown>;
  for (const key of CATALOG_TABLE_KEYS) {
    tables[key] = asRows(obj[key]);
  }
  return tables;
}

function truncateInput(text: string, max = 100_000): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n/* truncated for model context */`;
}

/**
 * Ask the model to reshape arbitrary JSON into a tempo-catalog v1 dump.
 */
export async function normalizeCatalogWithLlm(
  rawText: string,
  userId: string,
): Promise<CatalogDump> {
  const client = createOpenAIClient();
  const input = truncateInput(rawText);

  let response;
  try {
    response = await client.responses.create({
      model: IMPORT_MODEL,
      store: false,
      reasoning: { effort: "low" },
      instructions: [
        "You convert messy or outdated music-project catalog JSON into TEMPO's tempo-catalog format.",
        'Return ONLY JSON with shape: { "format":"tempo-catalog", "schemaVersion":1, "notes": string[], "tables": { ... } }.',
        `tables must include these keys (use [] when empty): ${CATALOG_TABLE_KEYS.join(", ")}.`,
        "Only use facts present in the input. Do not invent songs, dates, or people.",
        "Prefer keeping UUID ids when they look real. Map renamed fields to the closest current column names.",
        "Omit audio file contents. file_url / artwork_url may stay as storage path strings.",
      ].join(" "),
      input: `Normalize this catalog JSON:\n\n${input}`,
      text: { format: { type: "json_object" } },
    });
  } catch (err) {
    throw new Error(friendlyAIError(err));
  }

  const text = response.output_text;
  if (!text) {
    throw new Error("The model returned an empty catalog — try again.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("The model returned invalid JSON — try again.");
  }

  const detected = detectCatalogDump(parsed);
  if (detected.kind === "tempo-catalog") {
    return {
      ...detected.dump,
      userId: detected.dump.userId || userId,
      notes: [
        "This catalog was reshaped by TEMPO from a non-standard or older file. Review carefully before restoring.",
        ...detected.dump.notes,
      ],
    };
  }

  // Model returned tables without the wrapper — coerce manually.
  const obj =
    parsed && typeof parsed === "object"
      ? (parsed as { notes?: unknown; tables?: unknown })
      : {};
  const tables = coerceTables(obj.tables ?? parsed);
  const notes = Array.isArray(obj.notes)
    ? obj.notes.filter((n): n is string => typeof n === "string")
    : [];

  const nonEmpty = CATALOG_TABLE_KEYS.filter((k) => tables[k].length > 0);
  if (!nonEmpty.length) {
    throw new Error(
      "Couldn’t find any catalog rows in that file. Try a TEMPO export from Settings → Your data.",
    );
  }

  return {
    format: CATALOG_FORMAT,
    schemaVersion: CATALOG_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    userId,
    appVersion: "normalized",
    notes: [
      "This catalog was reshaped by TEMPO from a non-standard or older file. Review carefully before restoring.",
      ...notes,
    ],
    tables,
  };
}

export function tableKeysWithRows(tables: CatalogTables): CatalogTableKey[] {
  return CATALOG_TABLE_KEYS.filter((k) => tables[k].length > 0);
}
