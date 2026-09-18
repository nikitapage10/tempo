import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };

const CARD_FIELDS =
  "id, handle, display_name, emblem_url, palette_id, ice_color, amber_color, tagline, visibility, location, country_code, owner_user_id, artist_id";

/**
 * Hydrate profile cards the browser embed left null — typically a private
 * demo whose owner_user_id drifted. Only returns profiles this account owns
 * (by profile owner or by artists.user_id).
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401, headers });
  }

  const body = await req.json().catch(() => null);
  const ids = Array.isArray(body?.ids)
    ? Array.from(
        new Set(
          body.ids.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
        )
      )
    : [];
  if (!ids.length) {
    return NextResponse.json({ profiles: [] }, { headers });
  }
  if (ids.length > 50) {
    return NextResponse.json({ error: "Too many ids." }, { status: 400, headers });
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("artist_profiles")
    .select(`${CARD_FIELDS}, artists!inner(user_id, demo_kind)`)
    .in("id", ids);
  if (error) {
    console.error("[social/profile-cards]", error.message);
    return NextResponse.json({ error: "Could not load profiles." }, { status: 500, headers });
  }

  const profiles = (rows ?? [])
    .filter((row) => {
      const artist = row.artists as { user_id?: string } | { user_id?: string }[] | null;
      const owner =
        row.owner_user_id === user.id ||
        (Array.isArray(artist) ? artist[0]?.user_id : artist?.user_id) === user.id;
      return owner;
    })
    .map((row) => ({
      id: row.id,
      handle: row.handle,
      display_name: row.display_name,
      emblem_url: row.emblem_url,
      palette_id: row.palette_id,
      ice_color: row.ice_color,
      amber_color: row.amber_color,
      tagline: row.tagline,
      visibility: row.visibility,
      location: row.location,
      country_code: row.country_code,
    }));

  return NextResponse.json({ profiles }, { headers });
}
