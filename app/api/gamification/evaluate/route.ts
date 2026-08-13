import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { evaluateAchievements } from "@/lib/gamification/evaluate";

export const dynamic = "force-dynamic";

/**
 * POST /api/gamification/evaluate — awards any newly-earned achievements for
 * the signed-in user's own artist and returns which keys just fired, so the
 * client can queue toasts. Reads run under the caller's own RLS-scoped
 * session; only the two ledger tables' inserts use the service-role client,
 * since neither grants a client insert policy (migrations 087/088).
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
    console.error("[gamification][evaluate]", artistError);
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
    const { newlyAwardedKeys } = await evaluateAchievements(
      supabase,
      admin,
      user.id,
      artistId
    );
    return NextResponse.json({ newlyAwardedKeys });
  } catch (err) {
    console.error("[gamification][evaluate]", err);
    return NextResponse.json({ error: "Couldn’t update your progress." }, { status: 500 });
  }
}
