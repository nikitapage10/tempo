import { NextResponse, type NextRequest } from "next/server";
import { resolvePublicArtistProfile } from "@/lib/public-profile-server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** GET /api/p/[handle] — public, unauthenticated profile lookup. 404s for anything not `visibility = 'public'`. */
export async function GET(
  _req: NextRequest,
  { params }: { params: { handle: string } }
) {
  const profile = await resolvePublicArtistProfile(params.handle?.toLowerCase());
  if (!profile) {
    return NextResponse.json(
      { error: "This profile isn’t available." },
      { status: 404, headers: NO_STORE }
    );
  }
  return NextResponse.json(profile, { headers: NO_STORE });
}
