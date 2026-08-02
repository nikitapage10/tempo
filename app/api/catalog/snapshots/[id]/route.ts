import { NextResponse, type NextRequest } from "next/server";
import { catalogFilename } from "@/lib/catalog-backup/export";
import { restoreCatalogDump } from "@/lib/catalog-backup/restore";
import { readCatalogSnapshot } from "@/lib/catalog-backup/snapshots";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: { id: string } };

/**
 * GET /api/catalog/snapshots/[id] — download one snapshot as JSON.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to download a snapshot." }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const dump = await readCatalogSnapshot(admin, user.id, params.id);
    if (!dump) {
      return NextResponse.json({ error: "That snapshot isn’t available." }, { status: 404 });
    }
    const body = JSON.stringify(dump, null, 2);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${catalogFilename(new Date(dump.exportedAt))}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[catalog/snapshots/id]", err);
    return NextResponse.json(
      { error: "Couldn’t download that snapshot." },
      { status: 500 },
    );
  }
}

/**
 * POST /api/catalog/snapshots/[id] — restore (merge) from a snapshot.
 * Body: { confirm: true }
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to restore a snapshot." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.confirm) {
    return NextResponse.json(
      { error: "Confirm restore to continue." },
      { status: 400 },
    );
  }

  try {
    const admin = createAdminClient();
    const dump = await readCatalogSnapshot(admin, user.id, params.id);
    if (!dump) {
      return NextResponse.json({ error: "That snapshot isn’t available." }, { status: 404 });
    }
    const result = await restoreCatalogDump(supabase, user.id, dump, "merge");
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("[catalog/snapshots/id] restore", err);
    return NextResponse.json(
      { error: "Couldn’t restore that snapshot. Try again." },
      { status: 500 },
    );
  }
}
