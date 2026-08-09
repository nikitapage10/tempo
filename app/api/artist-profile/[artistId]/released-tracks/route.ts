import { NextResponse, type NextRequest } from "next/server";
import { resolveArtistReleasedTracks } from "@/lib/public-profile-server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET(
  _request: NextRequest,
  { params }: { params: { artistId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in required." },
      { status: 401, headers: NO_STORE }
    );
  }

  const { data: profile } = await supabase
    .from("artist_profiles")
    .select("artist_id")
    .eq("artist_id", params.artistId)
    .maybeSingle();

  // Artist-profile RLS is the access boundary: owners can see private
  // profiles, while other members only see profiles published to the network.
  if (!profile) {
    return NextResponse.json(
      { error: "Profile not found." },
      { status: 404, headers: NO_STORE }
    );
  }

  const tracks = await resolveArtistReleasedTracks(profile.artist_id);
  return NextResponse.json({ tracks }, { headers: NO_STORE });
}
