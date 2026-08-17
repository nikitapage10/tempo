/**
 * Public Session room state. Guests never touch a Supabase client.
 *
 * Hard rule: title, purpose, member display names, agenda, notes, chat, and
 * pin titles and artwork only. Never file_url, never a signed audio URL,
 * never an artist id.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_GUEST_UNAVAILABLE_MESSAGE } from "@/lib/sessions/copy";
import { noStoreHeaders, resolveGuestFromCookie } from "@/lib/sessions/public-request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const ctx = await resolveGuestFromCookie(params.token);
  if (!ctx) {
    return NextResponse.json({ error: SESSION_GUEST_UNAVAILABLE_MESSAGE }, { status: 401, headers: noStoreHeaders() });
  }
  const admin = createAdminClient();
  const roomId = ctx.link.session_room_id;

  const [{ data: room }, { data: members }, { data: agenda }, { data: pins }, { data: convo }] = await Promise.all([
    admin.from("session_rooms").select("title, purpose, notes").eq("id", roomId).maybeSingle(),
    admin
      .from("session_members")
      .select("profile:artist_profiles(display_name)")
      .eq("session_room_id", roomId)
      .eq("status", "active"),
    admin.from("session_agenda_items").select("id, body, done_at, sort").eq("session_room_id", roomId).order("sort"),
    admin.rpc("list_session_pin_summaries", { p_room: roomId }),
    admin.from("conversations").select("id").eq("session_room_id", roomId).maybeSingle(),
  ]);

  let messages: Array<{ id: string; body: string; created_at: string; author: string; mine: boolean; guest: boolean }> = [];
  if (convo?.id) {
    const { data: rows } = await admin
      .from("messages")
      .select("id, body, created_at, sender_profile_id, sender_session_guest_id")
      .eq("conversation_id", convo.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(80);
    const guestIds = Array.from(new Set((rows ?? []).map((row) => row.sender_session_guest_id).filter(Boolean))) as string[];
    const profileIds = Array.from(new Set((rows ?? []).map((row) => row.sender_profile_id).filter(Boolean))) as string[];
    const [{ data: guests }, { data: profiles }] = await Promise.all([
      guestIds.length
        ? admin.from("session_guests").select("id, display_name").in("id", guestIds)
        : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
      profileIds.length
        ? admin.from("artist_profiles").select("id, display_name").in("id", profileIds)
        : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
    ]);
    const guestName = new Map((guests ?? []).map((row) => [row.id, row.display_name]));
    const profileName = new Map((profiles ?? []).map((row) => [row.id, row.display_name]));
    messages = (rows ?? []).map((row) => ({
      id: row.id as string,
      body: row.body as string,
      created_at: row.created_at as string,
      author: (row.sender_session_guest_id ? guestName.get(row.sender_session_guest_id as string) : profileName.get(row.sender_profile_id as string)) || "Someone",
      mine: row.sender_session_guest_id === ctx.guest.id,
      guest: Boolean(row.sender_session_guest_id),
    }));
  }

  const artworkPaths = ((pins ?? []) as Array<{ artwork_path?: string | null }>).map((pin) => pin.artwork_path).filter(Boolean) as string[];
  const signed = new Map<string, string>();
  for (const path of artworkPaths) {
    const { data } = await admin.storage.from("audio").createSignedUrl(path, 3600);
    if (data?.signedUrl) signed.set(path, data.signedUrl);
  }

  const memberNames = (members ?? []).map((row) => {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    return { display_name: (profile as { display_name?: string } | null)?.display_name || "Member" };
  });

  return NextResponse.json(
    {
      title: room?.title ?? "Session",
      purpose: room?.purpose ?? "",
      notes: room?.notes ?? "",
      members: memberNames,
      agenda: (agenda ?? []).map((item) => ({ id: item.id, body: item.body, done: Boolean(item.done_at) })),
      pins: ((pins ?? []) as Array<{ id: string; title: string; artwork_path: string | null }>).map((pin) => ({
        id: pin.id,
        title: pin.title,
        artwork_url: pin.artwork_path ? signed.get(pin.artwork_path) ?? null : null,
      })),
      messages,
      allowChat: ctx.link.allow_guest_chat,
      allowMedia: ctx.link.allow_guest_media,
      guestName: ctx.guest.display_name,
    },
    { headers: noStoreHeaders() }
  );
}
