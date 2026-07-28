import { NextResponse } from "next/server";
import {
  IMPORT_UNAVAILABLE_MESSAGE,
  noStoreHeaders,
  resolveImport,
} from "@/lib/import-server";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/import/[id]/sources/[sourceId] — the "Remove source" control.
 * The artist must be able to take something back out before it's processed.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; sourceId: string } },
) {
  const ctx = await resolveImport(params.id);
  if (!ctx) {
    return NextResponse.json(
      { error: IMPORT_UNAVAILABLE_MESSAGE },
      { status: 404, headers: noStoreHeaders() },
    );
  }

  const { data: source } = await ctx.admin
    .from("onboarding_sources")
    .select("id, storage_path")
    .eq("id", params.sourceId)
    .eq("import_id", ctx.imp.id)
    .maybeSingle();

  if (!source) {
    return NextResponse.json(
      { error: IMPORT_UNAVAILABLE_MESSAGE },
      { status: 404, headers: noStoreHeaders() },
    );
  }

  if (source.storage_path) {
    const { error: storageError } = await ctx.admin.storage
      .from("audio")
      .remove([source.storage_path]);
    if (storageError) {
      console.error("[import] could not remove source file:", storageError.message);
    }
  }

  const { error } = await ctx.admin
    .from("onboarding_sources")
    .delete()
    .eq("id", source.id);

  if (error) {
    return NextResponse.json(
      { error: "Couldn’t remove that." },
      { status: 500, headers: noStoreHeaders() },
    );
  }

  return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
}
