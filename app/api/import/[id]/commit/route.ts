import { NextResponse, type NextRequest } from "next/server";
import {
  IMPORT_UNAVAILABLE_MESSAGE,
  deleteImportFiles,
  loadWorkspaceContext,
  noStoreHeaders,
  resolveImport,
  setImportStatus,
} from "@/lib/import-server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { toCommitPayload } from "@/lib/ai/commit-payload";
import { validatePlan } from "@/lib/ai/synthesize-plan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/import/[id]/commit — build the workspace.
 *
 * The only route that writes to the real catalog, and only what the artist
 * ticked. The edited plan is re-validated here with the same validator used on
 * the model's output, so client-side edits get the same treatment as the AI's
 * guesses: enums coerced, dangling refs dropped, stage names checked against
 * the target space.
 *
 * Body: { plan, selection: { trackRefs, projectRefs, taskRefs } }
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await resolveImport(params.id);
  if (!ctx) {
    return NextResponse.json(
      { error: IMPORT_UNAVAILABLE_MESSAGE },
      { status: 404, headers: noStoreHeaders() },
    );
  }

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload.plan !== "object" || !payload.plan) {
    return NextResponse.json(
      { error: "Nothing to build." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  const selection = payload.selection ?? {};
  const asRefs = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

  const context = await loadWorkspaceContext(ctx.admin, ctx.userId);
  const plan = validatePlan(payload.plan, context);

  const commitPayload = toCommitPayload(plan, {
    trackRefs: asRefs(selection.trackRefs),
    projectRefs: asRefs(selection.projectRefs),
    taskRefs: asRefs(selection.taskRefs),
  });

  const nothingSelected =
    commitPayload.tracks.length === 0 &&
    commitPayload.projects.length === 0 &&
    commitPayload.tasks.length === 0;

  if (nothingSelected) {
    return NextResponse.json(
      { error: "Pick at least one thing to add." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  await setImportStatus(ctx.admin, ctx.imp.id, "committing", { error: null });

  // Through the user's own session, not the service role: the function reads
  // auth.uid() to decide whose catalog this is.
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("commit_workspace_import", {
    p_import_id: ctx.imp.id,
    p_plan: commitPayload,
  });

  if (error) {
    console.error("[import] commit failed:", error.message);
    await setImportStatus(ctx.admin, ctx.imp.id, "needs_review", {
      error: "Couldn’t build your workspace. Nothing was added — try again.",
    });
    return NextResponse.json(
      { error: "Couldn’t build your workspace. Nothing was added — try again." },
      { status: 500, headers: noStoreHeaders() },
    );
  }

  // The catalog is built; the raw source material has done its job.
  await deleteImportFiles(ctx.admin, ctx.imp.id);

  return NextResponse.json({ summary: data }, { headers: noStoreHeaders() });
}
