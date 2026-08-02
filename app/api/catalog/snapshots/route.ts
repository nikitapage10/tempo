import { NextResponse, type NextRequest } from "next/server";
import {
  readSnapshotIndex,
  snapshotUserCatalog,
} from "@/lib/catalog-backup/snapshots";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/catalog/snapshots — list automatic metadata snapshots for the user.
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to view snapshots." }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const index = await readSnapshotIndex(admin, user.id);
    return NextResponse.json(
      { snapshots: index.snapshots, updatedAt: index.updatedAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[catalog/snapshots]", err);
    return NextResponse.json(
      { error: "Couldn’t load snapshots." },
      { status: 500 },
    );
  }
}

/**
 * POST /api/catalog/snapshots — take a manual snapshot now.
 */
export async function POST(_req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to save a snapshot." }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const meta = await snapshotUserCatalog(admin, user.id, "manual");
    return NextResponse.json({ snapshot: meta });
  } catch (err) {
    console.error("[catalog/snapshots] manual", err);
    return NextResponse.json(
      { error: "Couldn’t save a snapshot. Try again." },
      { status: 500 },
    );
  }
}
