import { NextResponse } from "next/server";
import {
  IMPORT_UNAVAILABLE_MESSAGE,
  deleteImportFiles,
  noStoreHeaders,
  resolveImport,
} from "@/lib/import-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/import/[id] — poll an import: status, its sources, and the plan
 * once there is one. This is what the processing screen watches, which is also
 * why progress lives in the database: a refresh mid-import picks up where it
 * left off instead of starting over.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await resolveImport(params.id);
  if (!ctx) {
    return NextResponse.json(
      { error: IMPORT_UNAVAILABLE_MESSAGE },
      { status: 404, headers: noStoreHeaders() },
    );
  }

  // extracted_text comes back so the intake transcript can show a typed note in
  // the artist's own words. It's their text; nothing is revealed by returning it.
  const { data: sources } = await ctx.admin
    .from("onboarding_sources")
    .select("id, kind, label, byte_size, mime_type, status, error, sort, created_at, extracted_text")
    .eq("import_id", ctx.imp.id)
    .order("sort")
    .order("created_at");

  return NextResponse.json(
    {
      import: {
        id: ctx.imp.id,
        status: ctx.imp.status,
        plan: ctx.imp.plan,
        summary: ctx.imp.summary,
        error: ctx.imp.error,
        committedAt: ctx.imp.committed_at,
        createdAt: ctx.imp.created_at,
      },
      sources: sources ?? [],
    },
    { headers: noStoreHeaders() },
  );
}

/**
 * DELETE /api/import/[id] — cancel an import and delete everything it holds,
 * including the uploaded source files. This is the "Delete import data" control.
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await resolveImport(params.id);
  if (!ctx) {
    return NextResponse.json(
      { error: IMPORT_UNAVAILABLE_MESSAGE },
      { status: 404, headers: noStoreHeaders() },
    );
  }

  // Files first — if the row goes away we lose the paths.
  await deleteImportFiles(ctx.admin, ctx.imp.id);

  // Cascade removes sources and commit audit rows with it.
  const { error } = await ctx.admin
    .from("onboarding_imports")
    .delete()
    .eq("id", ctx.imp.id);

  if (error) {
    console.error("[import] delete failed:", error.message);
    return NextResponse.json(
      { error: "Couldn’t delete that import." },
      { status: 500, headers: noStoreHeaders() },
    );
  }

  return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
}
