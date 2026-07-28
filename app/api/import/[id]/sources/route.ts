import { NextResponse, type NextRequest } from "next/server";
import {
  IMPORT_UNAVAILABLE_MESSAGE,
  noStoreHeaders,
  resolveImport,
} from "@/lib/import-server";

export const dynamic = "force-dynamic";

const KINDS = new Set(["text", "voice", "image", "document"]);
const MAX_TEXT_CHARS = 50_000;
const MAX_SOURCES = 40;

/**
 * POST /api/import/[id]/sources — add one piece of source material.
 *
 * Text arrives inline. Files are uploaded to storage by the browser first (so
 * the bytes never pass through a serverless function body) and register their
 * path here.
 *
 * Body: { kind, label?, text?, storagePath?, byteSize?, mimeType? }
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload.kind !== "string" || !KINDS.has(payload.kind)) {
    return NextResponse.json(
      { error: "That isn’t something TEMPO can read." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  const isText = payload.kind === "text";
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  const storagePath = typeof payload.storagePath === "string" ? payload.storagePath : null;

  if (isText && !text) {
    return NextResponse.json(
      { error: "Add a few words first." },
      { status: 400, headers: noStoreHeaders() },
    );
  }
  if (!isText && !storagePath) {
    return NextResponse.json(
      { error: "That file didn’t finish uploading." },
      { status: 400, headers: noStoreHeaders() },
    );
  }
  // A storage path must sit inside this import's own folder.
  if (storagePath && !storagePath.startsWith(`imports/${ctx.imp.id}/`)) {
    return NextResponse.json(
      { error: "That file didn’t finish uploading." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  const { count } = await ctx.admin
    .from("onboarding_sources")
    .select("id", { count: "exact", head: true })
    .eq("import_id", ctx.imp.id);

  if ((count ?? 0) >= MAX_SOURCES) {
    return NextResponse.json(
      { error: `That's the most TEMPO can take in one go (${MAX_SOURCES} items).` },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  const { data, error } = await ctx.admin
    .from("onboarding_sources")
    .insert({
      import_id: ctx.imp.id,
      kind: payload.kind,
      label: typeof payload.label === "string" ? payload.label.slice(0, 200) : null,
      storage_path: storagePath,
      byte_size: typeof payload.byteSize === "number" ? payload.byteSize : null,
      mime_type: typeof payload.mimeType === "string" ? payload.mimeType.slice(0, 120) : null,
      // Inline text needs no extraction pass.
      extracted_text: isText ? text.slice(0, MAX_TEXT_CHARS) : null,
      status: isText ? "ready" : "pending",
      sort: count ?? 0,
    })
    .select("id, kind, label, byte_size, mime_type, status, error, sort, created_at, extracted_text")
    .single();

  if (error || !data) {
    console.error("[import] could not add source:", error?.message);
    return NextResponse.json(
      { error: "Couldn’t add that." },
      { status: 500, headers: noStoreHeaders() },
    );
  }

  return NextResponse.json({ source: data }, { headers: noStoreHeaders() });
}
