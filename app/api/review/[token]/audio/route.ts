import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  GUEST_LINK_UNAVAILABLE_MESSAGE,
  noStoreHeaders,
  resolveGuestLink,
} from "@/lib/guest-review";

export const dynamic = "force-dynamic";

/**
 * GET /api/review/[token]/audio — signs a playback URL for the *linked*
 * version's file only. The client never supplies a version id; it always
 * comes from the validated guest_review_links row (TECHNICAL-ARCHITECTURE §3).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const ctx = await resolveGuestLink(params.token);
  if (!ctx) {
    return NextResponse.json(
      { error: GUEST_LINK_UNAVAILABLE_MESSAGE },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from("audio")
      .createSignedUrl(ctx.version.file_url, 3600);
    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: GUEST_LINK_UNAVAILABLE_MESSAGE },
        { status: 404, headers: noStoreHeaders() }
      );
    }
    return NextResponse.json({ url: data.signedUrl }, { headers: noStoreHeaders() });
  } catch {
    return NextResponse.json(
      { error: GUEST_LINK_UNAVAILABLE_MESSAGE },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}
