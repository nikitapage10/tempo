import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  GUEST_LINK_UNAVAILABLE_MESSAGE,
  noStoreHeaders,
  resolveGuestLink,
} from "@/lib/guest-review";

export const dynamic = "force-dynamic";

/**
 * GET /api/review/[token] — allowlisted, read-only summary for the guest
 * review page: track title/artwork, the linked version's fields, and the
 * owner's allow_comments/allow_download flags. Never notes, checklist,
 * other versions, tasks, or owner identity (SECURITY-AND-PERMISSIONS.md §2).
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

  let artworkUrl: string | null = null;
  if (ctx.track.artwork_url) {
    try {
      const admin = createAdminClient();
      const { data } = await admin.storage
        .from("audio")
        .createSignedUrl(ctx.track.artwork_url, 3600);
      artworkUrl = data?.signedUrl ?? null;
    } catch {
      artworkUrl = null;
    }
  }

  return NextResponse.json(
    {
      track: {
        title: ctx.track.title,
        artist_alias: ctx.track.artist_alias,
        artwork_url: artworkUrl,
      },
      version: {
        id: ctx.version.id,
        version_no: ctx.version.version_no,
        label: ctx.version.label,
        changelog: ctx.version.changelog,
        duration: ctx.version.duration,
        created_at: ctx.version.created_at,
      },
      allow_comments: ctx.link.allow_comments,
      allow_download: ctx.link.allow_download,
      link_label: ctx.link.label,
    },
    { headers: noStoreHeaders() }
  );
}
