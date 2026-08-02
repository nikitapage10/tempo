import { NextResponse } from "next/server";
import {
  buildCatalogDump,
  catalogFilename,
} from "@/lib/catalog-backup/export";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/catalog/export — download the signed-in user's metadata catalog.
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to export your catalog." }, { status: 401 });
  }

  try {
    const dump = await buildCatalogDump(supabase, user.id);
    const body = JSON.stringify(dump, null, 2);
    const filename = catalogFilename(new Date(dump.exportedAt));
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[catalog/export]", err);
    return NextResponse.json(
      { error: "Couldn’t build your catalog export. Try again." },
      { status: 500 },
    );
  }
}
