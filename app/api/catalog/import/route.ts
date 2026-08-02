import { NextResponse, type NextRequest } from "next/server";
import { detectCatalogDump } from "@/lib/catalog-backup/detect";
import { normalizeCatalogWithLlm } from "@/lib/catalog-backup/normalize-with-llm";
import { restoreCatalogDump } from "@/lib/catalog-backup/restore";
import { summarizeTables } from "@/lib/catalog-backup/detect";
import { isOpenAIConfigured } from "@/lib/ai/openai";
import { createClient } from "@/lib/supabase/server";
import type { CatalogDump } from "@/lib/catalog-backup/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ImportBody = {
  /** Parsed JSON from the client, or omit and send `text`. */
  dump?: unknown;
  text?: string;
  /** Preview only — do not write. */
  preview?: boolean;
  /** Allow LLM reshape when detection fails. */
  allowNormalize?: boolean;
  /** Confirm restore after preview. */
  confirm?: boolean;
};

async function resolveDump(
  body: ImportBody,
  userId: string,
): Promise<{ dump: CatalogDump; normalized: boolean } | { error: string; status: number }> {
  let raw: unknown = body.dump;
  if (raw === undefined && typeof body.text === "string") {
    try {
      raw = JSON.parse(body.text) as unknown;
    } catch {
      return { error: "That file isn’t valid JSON.", status: 400 };
    }
  }
  if (raw === undefined) {
    return { error: "Nothing to restore.", status: 400 };
  }

  const detected = detectCatalogDump(raw);
  if (detected.kind === "tempo-catalog") {
    return { dump: detected.dump, normalized: false };
  }

  if (!body.allowNormalize) {
    return {
      error:
        "That doesn’t look like a TEMPO catalog export. Turn on smart reshape, or use Import for spreadsheets and notes.",
      status: 400,
    };
  }

  if (!isOpenAIConfigured()) {
    return {
      error:
        "Smart reshape needs the AI key on the server. Use a TEMPO export from Settings, or set up Import Studio.",
      status: 503,
    };
  }

  const text =
    typeof body.text === "string" ? body.text : JSON.stringify(raw);
  try {
    const dump = await normalizeCatalogWithLlm(text, userId);
    return { dump, normalized: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Couldn’t reshape that file.";
    return { error: message, status: 422 };
  }
}

/**
 * POST /api/catalog/import — preview or merge-restore a catalog dump.
 *
 * Body: { dump | text, preview?, allowNormalize?, confirm? }
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to restore a catalog." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as ImportBody | null;
  if (!body) {
    return NextResponse.json({ error: "Nothing to restore." }, { status: 400 });
  }

  const resolved = await resolveDump(body, user.id);
  if ("error" in resolved) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status },
    );
  }

  const { dump, normalized } = resolved;
  const summary = summarizeTables(dump.tables);

  if (body.preview || !body.confirm) {
    return NextResponse.json({
      preview: true,
      normalized,
      exportedAt: dump.exportedAt,
      schemaVersion: dump.schemaVersion,
      summary,
      notes: dump.notes,
      counts: {
        artists: dump.tables.artists.length,
        spaces: dump.tables.spaces.length,
        tracks: dump.tables.tracks.length,
        projects: dump.tables.projects.length,
        tasks: dump.tables.tasks.length,
        sessions: dump.tables.sessions.length,
        calendar_events: dump.tables.calendar_events.length,
      },
    });
  }

  try {
    const result = await restoreCatalogDump(supabase, user.id, dump, "merge");
    return NextResponse.json({
      ok: true,
      normalized,
      summary,
      result,
    });
  } catch (err) {
    console.error("[catalog/import]", err);
    return NextResponse.json(
      { error: "Couldn’t restore that catalog. Nothing was partially left on purpose — try again." },
      { status: 500 },
    );
  }
}
