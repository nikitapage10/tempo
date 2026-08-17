/**
 * Guest LiveKit token. The passcode is not re-checked here; the cookie is the bearer.
 * Never file_url, never a signed audio URL, never an artist id.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_GUEST_UNAVAILABLE_MESSAGE } from "@/lib/sessions/copy";
import {
  isLiveKitConfigured,
  LIVEKIT_UNAVAILABLE_MESSAGE,
  mintSessionLiveKitToken,
} from "@/lib/sessions/livekit";
import { noStoreHeaders, resolveGuestFromCookie } from "@/lib/sessions/public-request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
  if (!isLiveKitConfigured()) {
    return NextResponse.json({ error: LIVEKIT_UNAVAILABLE_MESSAGE }, { status: 503, headers: noStoreHeaders() });
  }
  const ctx = await resolveGuestFromCookie(params.token);
  if (!ctx) {
    return NextResponse.json({ error: SESSION_GUEST_UNAVAILABLE_MESSAGE }, { status: 401, headers: noStoreHeaders() });
  }
  if (ctx.link.max_guests) {
    const admin = createAdminClient();
    const { count } = await admin
      .from("session_guests")
      .select("id", { count: "exact", head: true })
      .eq("session_link_id", ctx.link.id)
      .is("revoked_at", null);
    if ((count ?? 0) > ctx.link.max_guests) {
      return NextResponse.json({ error: SESSION_GUEST_UNAVAILABLE_MESSAGE }, { status: 403, headers: noStoreHeaders() });
    }
  }
  const minted = await mintSessionLiveKitToken({
    sessionRoomId: ctx.link.session_room_id,
    kind: "guest",
    id: ctx.guest.id,
    displayName: ctx.guest.display_name,
    canPublish: ctx.link.allow_guest_media,
    ttlSeconds: 2 * 60 * 60,
  });
  return NextResponse.json(minted, { headers: noStoreHeaders() });
}
