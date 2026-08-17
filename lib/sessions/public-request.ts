import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  guestCookieName,
  linkIsJoinable,
  lookupSessionLinkByToken,
  sha256Hex,
  type SessionLinkRow,
} from "@/lib/sessions/link";

export type SessionGuestRow = {
  id: string;
  session_room_id: string;
  session_link_id: string;
  display_name: string;
  guest_key_hash: string;
  revoked_at: string | null;
};

export async function resolvePublicLink(token: string): Promise<SessionLinkRow | null> {
  const link = await lookupSessionLinkByToken(token);
  if (!link || !linkIsJoinable(link)) return null;
  return link;
}

export async function resolveGuestFromCookie(
  token: string
): Promise<{ link: SessionLinkRow; guest: SessionGuestRow } | null> {
  const link = await resolvePublicLink(token);
  if (!link) return null;
  const raw = cookies().get(guestCookieName(link.id))?.value;
  if (!raw) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("session_guests")
    .select("id, session_room_id, session_link_id, display_name, guest_key_hash, revoked_at")
    .eq("session_link_id", link.id)
    .eq("guest_key_hash", sha256Hex(raw))
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  return { link, guest: data as SessionGuestRow };
}

export function noStoreHeaders(): HeadersInit {
  return { "Cache-Control": "no-store" };
}
