import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  GUEST_LINK_UNAVAILABLE_MESSAGE,
  noStoreHeaders,
  resolveGuestLink,
} from "@/lib/guest-review";

export const dynamic = "force-dynamic";

/**
 * GET /api/review/[token]/download — only when the link owner explicitly
 * enabled `allow_download`. Otherwise this behaves exactly like an invalid
 * token (generic 404) so it can't be used to probe link configuration.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const ctx = await resolveGuestLink(params.token);
  if (!ctx || !ctx.link.allow_download) {
    return NextResponse.json(
      { error: GUEST_LINK_UNAVAILABLE_MESSAGE },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  try {
    const admin = createAdminClient();
    const filename =
      (ctx.version.label || `v${ctx.version.version_no}`).replace(/[^\w.\- ]+/g, "_") ||
      `v${ctx.version.version_no}`;
    const { data, error } = await admin.storage
      .from("audio")
      .createSignedUrl(ctx.version.file_url, 3600, { download: filename });
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
