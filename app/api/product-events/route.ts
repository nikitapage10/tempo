import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { recordProductEventServer } from "@/lib/product-events/record-server";

export const dynamic = "force-dynamic";

/**
 * POST /api/product-events — the only insert path for product_events. The
 * caller never supplies user_id; it is derived from the authenticated
 * session. Always returns 204 to the caller regardless of accept/reject/
 * duplicate outcome — client-side telemetry is best-effort and must never
 * surface an error toast or retry loop to the member (02-TECHNICAL-AND-
 * DATA-DESIGN.md §2.2, §4.3).
 */
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 204 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  if (typeof body !== "object" || body === null) {
    return new NextResponse(null, { status: 204 });
  }

  const { event_name, properties, artist_id, space_id, source_surface, dedupe_key } =
    body as Record<string, unknown>;

  if (typeof event_name !== "string") {
    return new NextResponse(null, { status: 204 });
  }

  await recordProductEventServer({
    userId: user.id,
    eventName: event_name,
    properties,
    artistId: typeof artist_id === "string" ? artist_id : null,
    spaceId: typeof space_id === "string" ? space_id : null,
    sourceSurface: typeof source_surface === "string" ? source_surface.slice(0, 64) : null,
    dedupeKey: typeof dedupe_key === "string" ? dedupe_key.slice(0, 200) : null,
  });

  return new NextResponse(null, { status: 204 });
}
