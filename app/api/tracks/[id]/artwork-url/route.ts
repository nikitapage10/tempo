import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * Owner-aware fallback for artwork objects uploaded by a trusted server.
 *
 * Older imported covers may not carry a Supabase Storage owner, which keeps a
 * browser client from signing them even though the track itself is readable.
 * The normal client-side signer remains the fast path; this endpoint verifies
 * track access through RLS, then signs only that track's recorded artwork.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to view this cover." },
      { status: 401, headers: NO_STORE }
    );
  }

  // This query intentionally uses the user's client. Track RLS admits the
  // owner and active collaborators and hides every other track.
  const { data: track, error: trackError } = await supabase
    .from("tracks")
    .select("artwork_url")
    .eq("id", params.id)
    .maybeSingle();
  if (trackError || !track?.artwork_url) {
    return NextResponse.json(
      { error: "That cover isn't available." },
      { status: 404, headers: NO_STORE }
    );
  }

  const path = String(track.artwork_url);
  const pathParts = path.split("/");
  const isTrackArtworkPath =
    pathParts.length === 5 &&
    pathParts[0] === "tracks" &&
    pathParts[1] === params.id &&
    pathParts[2] === "assets" &&
    /^[0-9a-f-]{36}$/i.test(pathParts[3]) &&
    pathParts[4].length > 0;
  if (!isTrackArtworkPath) {
    return NextResponse.json(
      { error: "That cover isn't stored in TEMPO." },
      { status: 400, headers: NO_STORE }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("audio")
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: "Couldn't open that cover." },
      { status: 500, headers: NO_STORE }
    );
  }

  return NextResponse.json(
    { url: data.signedUrl },
    { headers: NO_STORE }
  );
}
