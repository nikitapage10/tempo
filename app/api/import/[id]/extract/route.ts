import { NextResponse } from "next/server";
import {
  IMPORT_UNAVAILABLE_MESSAGE,
  noStoreHeaders,
  resolveImport,
  setImportStatus,
  type ImportSourceRow,
} from "@/lib/import-server";
import { extractSource } from "@/lib/ai/extract-sources";
import { friendlyAIError } from "@/lib/ai/openai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Leaves room to finish the source in flight and write results back before the
 * function is killed. The client just calls again while hasMore is true, so a
 * big import becomes several short requests rather than one that times out.
 */
const TIME_BUDGET_MS = 40_000;

/**
 * POST /api/import/[id]/extract — read pending sources into plain text.
 *
 * Returns { hasMore } so the browser can keep calling until everything is read.
 * Each source's result is written as it completes, so a timeout mid-batch loses
 * at most one source's work.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await resolveImport(params.id);
  if (!ctx) {
    return NextResponse.json(
      { error: IMPORT_UNAVAILABLE_MESSAGE },
      { status: 404, headers: noStoreHeaders() },
    );
  }

  if (ctx.imp.committed_at) {
    return NextResponse.json(
      { error: "That import is already built." },
      { status: 409, headers: noStoreHeaders() },
    );
  }

  const startedAt = Date.now();
  await setImportStatus(ctx.admin, ctx.imp.id, "extracting", { error: null });

  const { data: pending } = await ctx.admin
    .from("onboarding_sources")
    .select("*")
    .eq("import_id", ctx.imp.id)
    .eq("status", "pending")
    .order("sort");

  const queue = (pending ?? []) as ImportSourceRow[];
  const warnings: string[] = [];
  let processed = 0;

  for (const source of queue) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;

    await ctx.admin
      .from("onboarding_sources")
      .update({ status: "extracting" })
      .eq("id", source.id);

    try {
      let bytes: Buffer | null = null;

      if (source.storage_path) {
        const { data: blob, error: downloadError } = await ctx.admin.storage
          .from("audio")
          .download(source.storage_path);

        if (downloadError || !blob) {
          throw new Error(downloadError?.message || "File missing from storage.");
        }
        bytes = Buffer.from(await blob.arrayBuffer());
      }

      const result = await extractSource({
        kind: source.kind,
        label: source.label,
        mimeType: source.mime_type,
        text: source.extracted_text,
        bytes,
      });

      if (result.warning) warnings.push(`${source.label || "A file"}: ${result.warning}`);

      await ctx.admin
        .from("onboarding_sources")
        .update({
          extracted_text: result.text,
          // Nothing readable is not a failure — it just contributes nothing.
          status: result.text ? "ready" : "excluded",
          error: result.warning ?? null,
        })
        .eq("id", source.id);
    } catch (err) {
      const message = friendlyAIError(err);
      await ctx.admin
        .from("onboarding_sources")
        .update({ status: "failed", error: message })
        .eq("id", source.id);
      warnings.push(`${source.label || "A file"}: ${message}`);
    }

    processed += 1;
  }

  const { count: stillPending } = await ctx.admin
    .from("onboarding_sources")
    .select("id", { count: "exact", head: true })
    .eq("import_id", ctx.imp.id)
    .eq("status", "pending");

  const hasMore = (stillPending ?? 0) > 0;
  if (!hasMore) {
    await setImportStatus(ctx.admin, ctx.imp.id, "draft");
  }

  return NextResponse.json(
    { processed, hasMore, remaining: stillPending ?? 0, warnings },
    { headers: noStoreHeaders() },
  );
}
