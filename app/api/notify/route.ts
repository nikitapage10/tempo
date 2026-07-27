import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function noStoreHeaders(): HeadersInit {
  return { "Cache-Control": "no-store" };
}

/**
 * POST /api/notify — create notifications for other people on a track.
 * Client-side inserts can't do this (notifications RLS only allows
 * user_id = auth.uid()), so this runs with the service role after checking
 * the caller has access to the track and, in direct mode, that the
 * recipient does too (SECURITY-AND-PERMISSIONS.md §5).
 *
 * Body: { trackId, type, title, body?, targetUserId? }
 * - targetUserId set: notify just that person (must share track access).
 * - targetUserId omitted: broadcast to the owner + active collaborators,
 *   excluding whoever triggered the action.
 */
export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null);
  if (
    !payload ||
    typeof payload.trackId !== "string" ||
    typeof payload.type !== "string" ||
    typeof payload.title !== "string"
  ) {
    return NextResponse.json(
      { error: "Invalid notification request." },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in first." },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const admin = createAdminClient();
  const { data: track } = await admin
    .from("tracks")
    .select("id, user_id")
    .eq("id", payload.trackId)
    .maybeSingle();
  if (!track) {
    return NextResponse.json(
      { error: "Track not found." },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const isOwner = track.user_id === user.id;
  const { data: myCollab } = await admin
    .from("track_collaborators")
    .select("id")
    .eq("track_id", track.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!isOwner && !myCollab) {
    return NextResponse.json(
      { error: "You don’t have access to this track." },
      { status: 403, headers: noStoreHeaders() }
    );
  }

  let recipients: string[];
  if (typeof payload.targetUserId === "string") {
    const targetIsOwner = track.user_id === payload.targetUserId;
    const { data: targetCollab } = await admin
      .from("track_collaborators")
      .select("id")
      .eq("track_id", track.id)
      .eq("user_id", payload.targetUserId)
      .eq("status", "active")
      .maybeSingle();
    if (!targetIsOwner && !targetCollab) {
      return NextResponse.json(
        { error: "Recipient doesn’t have access to this track." },
        { status: 403, headers: noStoreHeaders() }
      );
    }
    recipients = [payload.targetUserId];
  } else {
    const { data: collabs } = await admin
      .from("track_collaborators")
      .select("user_id")
      .eq("track_id", track.id)
      .eq("status", "active");
    const ids = new Set<string>([track.user_id]);
    for (const c of collabs ?? []) {
      if (c.user_id) ids.add(c.user_id);
    }
    recipients = Array.from(ids);
  }

  recipients = recipients.filter((id) => id !== user.id);
  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, notified: 0 }, { headers: noStoreHeaders() });
  }

  const rows = recipients.map((uid) => ({
    user_id: uid,
    track_id: track.id,
    type: payload.type,
    title: payload.title,
    body: typeof payload.body === "string" ? payload.body : null,
  }));

  const { error } = await admin.from("notifications").insert(rows);
  if (error) {
    return NextResponse.json(
      { error: "Couldn’t send notifications." },
      { status: 500, headers: noStoreHeaders() }
    );
  }

  return NextResponse.json(
    { ok: true, notified: rows.length },
    { headers: noStoreHeaders() }
  );
}
