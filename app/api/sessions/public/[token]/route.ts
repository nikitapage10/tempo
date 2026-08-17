/**
 * Public Session join. Guests never touch a Supabase client.
 *
 * Hard rule: serialize title, purpose, member display names, agenda, notes,
 * chat, and pin titles and artwork only. Never file_url, never a signed
 * audio URL, never an artist id.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateGuestKey,
  guestCookieName,
  isLinkLocked,
  registerPasscodeFailure,
  SESSION_GUEST_NAME_MAX_LEN,
  SESSION_GUEST_UNAVAILABLE_MESSAGE,
  sha256Hex,
  verifyPasscode,
} from "@/lib/sessions/link";
import { noStoreHeaders, resolvePublicLink } from "@/lib/sessions/public-request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bursts = new Map<string, { count: number; start: number }>();
const BURST_LIMIT = 10;
const BURST_WINDOW_MS = 10 * 60 * 1000;

function clientKey(req: NextRequest, token: string) {
  return `${req.headers.get("x-forwarded-for") ?? "unknown"}:${token}`;
}

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const link = await resolvePublicLink(params.token);
  if (!link) {
    return NextResponse.json({ error: SESSION_GUEST_UNAVAILABLE_MESSAGE }, { status: 404, headers: noStoreHeaders() });
  }
  const admin = createAdminClient();
  const { data: room } = await admin.from("session_rooms").select("title").eq("id", link.session_room_id).maybeSingle();
  return NextResponse.json({ title: room?.title ?? "Session" }, { headers: noStoreHeaders() });
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.website === "string" && body.website.trim()) {
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  }

  const key = clientKey(req, params.token);
  const now = Date.now();
  const burst = bursts.get(key);
  if (burst && now - burst.start < BURST_WINDOW_MS && burst.count >= BURST_LIMIT) {
    return NextResponse.json({ error: SESSION_GUEST_UNAVAILABLE_MESSAGE }, { status: 429, headers: noStoreHeaders() });
  }
  bursts.set(key, { count: (burst && now - burst.start < BURST_WINDOW_MS ? burst.count : 0) + 1, start: burst && now - burst.start < BURST_WINDOW_MS ? burst.start : now });

  const link = await resolvePublicLink(params.token);
  if (!link) {
    return NextResponse.json({ error: SESSION_GUEST_UNAVAILABLE_MESSAGE }, { status: 404, headers: noStoreHeaders() });
  }
  if (isLinkLocked(link.locked_until)) {
    return NextResponse.json({ error: SESSION_GUEST_UNAVAILABLE_MESSAGE }, { status: 403, headers: noStoreHeaders() });
  }

  const passcode = typeof body.passcode === "string" ? body.passcode : "";
  const displayName = typeof body.display_name === "string" ? body.display_name.trim().slice(0, SESSION_GUEST_NAME_MAX_LEN) : "";
  const admin = createAdminClient();

  if (!verifyPasscode(passcode, link.passcode_salt, link.passcode_hash)) {
    const next = registerPasscodeFailure(link.failed_attempts);
    await admin
      .from("session_links")
      .update({ failed_attempts: next.failedAttempts, locked_until: next.lockedUntil?.toISOString() ?? null })
      .eq("id", link.id);
    return NextResponse.json({ error: SESSION_GUEST_UNAVAILABLE_MESSAGE }, { status: 403, headers: noStoreHeaders() });
  }

  if (!displayName) {
    return NextResponse.json({ error: SESSION_GUEST_UNAVAILABLE_MESSAGE }, { status: 400, headers: noStoreHeaders() });
  }

  await admin.from("session_links").update({ failed_attempts: 0, locked_until: null }).eq("id", link.id);

  const guestKey = generateGuestKey().toString("base64url");
  const { data: guest, error } = await admin
    .from("session_guests")
    .insert({
      session_room_id: link.session_room_id,
      session_link_id: link.id,
      display_name: displayName,
      guest_key_hash: sha256Hex(guestKey),
    })
    .select("id")
    .single();
  if (error || !guest) {
    return NextResponse.json({ error: SESSION_GUEST_UNAVAILABLE_MESSAGE }, { status: 500, headers: noStoreHeaders() });
  }

  const response = NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  response.cookies.set(guestCookieName(link.id), guestKey, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
