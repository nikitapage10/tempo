import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { backfillArtist } from "@/lib/gamification/backfill";

export const dynamic = "force-dynamic";

/**
 * POST /api/gamification/backfill — replays an artist's existing history
 * into the point ledger the first time they open the attribute sheet.
 * Idempotent (see lib/gamification/backfill.ts); the client can call this
 * on every sheet mount without worrying about double-counting.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const artistId = body?.artistId;
  if (typeof artistId !== "string" || !artistId) {
    return NextResponse.json({ error: "artistId is required." }, { status: 400 });
  }

  const { data: artist, error: artistError } = await supabase
    .from("artists")
    .select("id, user_id")
    .eq("id", artistId)
    .maybeSingle();
  if (artistError) {
    console.error("[gamification][backfill]", artistError);
    return NextResponse.json({ error: "Couldn’t load that artist." }, { status: 500 });
  }
  if (!artist || artist.user_id !== user.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 }
    );
  }

  try {
    const admin = createAdminClient();
    const { newlyAwardedKeys } = await backfillArtist(supabase, admin, user.id, artistId);
    return NextResponse.json({ newlyAwardedKeys });
  } catch (err) {
    console.error("[gamification][backfill]", err);
    return NextResponse.json({ error: "Couldn’t catch up your history." }, { status: 500 });
  }
}
