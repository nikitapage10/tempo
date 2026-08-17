/**
 * Public Session guest chat. Guests never touch a Supabase client.
 * Never file_url, never a signed audio URL, never an artist id.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_GUEST_UNAVAILABLE_MESSAGE } from "@/lib/sessions/copy";
import { noStoreHeaders, resolveGuestFromCookie } from "@/lib/sessions/public-request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const ctx = await resolveGuestFromCookie(params.token);
  if (!ctx) {
    return NextResponse.json({ error: SESSION_GUEST_UNAVAILABLE_MESSAGE }, { status: 401, headers: noStoreHeaders() });
  }
  if (!ctx.link.allow_guest_chat) {
    return NextResponse.json({ error: SESSION_GUEST_UNAVAILABLE_MESSAGE }, { status: 403, headers: noStoreHeaders() });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.website === "string" && body.website.trim()) {
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  }
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Write something first." }, { status: 400, headers: noStoreHeaders() });
  }
  const admin = createAdminClient();
  const { data: convo } = await admin
    .from("conversations")
    .select("id")
    .eq("session_room_id", ctx.link.session_room_id)
    .maybeSingle();
  if (!convo?.id) {
    return NextResponse.json({ error: SESSION_GUEST_UNAVAILABLE_MESSAGE }, { status: 500, headers: noStoreHeaders() });
  }
  const { error } = await admin.from("messages").insert({
    conversation_id: convo.id,
    sender_profile_id: null,
    sender_user_id: null,
    sender_session_guest_id: ctx.guest.id,
    body: text.slice(0, 5000),
  });
  if (error) {
    return NextResponse.json({ error: SESSION_GUEST_UNAVAILABLE_MESSAGE }, { status: 500, headers: noStoreHeaders() });
  }
  await admin.from("session_guests").update({ last_seen_at: new Date().toISOString() }).eq("id", ctx.guest.id);
  return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
}
