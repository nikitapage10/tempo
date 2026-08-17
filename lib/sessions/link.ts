/**
 * Server-only Session public-link helpers. Analogous to lib/guest-review.ts.
 *
 * Passcodes are hashed with scrypt in this module, never in the browser and
 * never in SQL. A 32-byte link token is sha256-hashed; a passcode is short
 * and human-chosen, so a fast hash would be brute-forceable.
 *
 * This file is imported by /api/sessions/* route handlers (Node runtime).
 */

import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_GUEST_UNAVAILABLE_MESSAGE } from "@/lib/sessions/copy";

export { SESSION_GUEST_UNAVAILABLE_MESSAGE };

export const SESSION_LINK_MAX_FAILURES = 8;
export const SESSION_LINK_LOCKOUT_MS = 15 * 60 * 1000;
export const SESSION_PASSCODE_MIN_LENGTH = 6;
export const SESSION_GUEST_NAME_MAX_LEN = 60;

const SCRYPT_KEY_LEN = 32;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 } as const;

export function sha256Hex(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function generateLinkToken(): string {
  return randomBytes(32).toString("base64url");
}

export function generateGuestKey(): Buffer {
  return randomBytes(32);
}

export function hashPasscode(passcode: string, salt: Buffer): Buffer {
  return scryptSync(passcode, salt, SCRYPT_KEY_LEN, SCRYPT_OPTIONS);
}

export function makePasscodeRecord(passcode: string): { saltHex: string; hashHex: string } {
  const salt = randomBytes(16);
  return {
    saltHex: salt.toString("hex"),
    hashHex: hashPasscode(passcode, salt).toString("hex"),
  };
}

export function verifyPasscode(passcode: string, saltHex: string, hashHex: string): boolean {
  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = hashPasscode(passcode, salt);
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function isLinkLocked(lockedUntil: string | Date | null, now = new Date()): boolean {
  if (!lockedUntil) return false;
  return new Date(lockedUntil).getTime() > now.getTime();
}

/** Apply one failed attempt. Eight failures lock the link for 15 minutes. */
export function registerPasscodeFailure(
  failedAttempts: number,
  now = new Date()
): { failedAttempts: number; lockedUntil: Date | null } {
  const next = failedAttempts + 1;
  if (next >= SESSION_LINK_MAX_FAILURES) {
    return {
      failedAttempts: next,
      lockedUntil: new Date(now.getTime() + SESSION_LINK_LOCKOUT_MS),
    };
  }
  return { failedAttempts: next, lockedUntil: null };
}

export function guestUnavailable(): { ok: false; message: string } {
  return { ok: false, message: SESSION_GUEST_UNAVAILABLE_MESSAGE };
}

export type SessionLinkRow = {
  id: string;
  session_room_id: string;
  token_hash: string;
  passcode_salt: string;
  passcode_hash: string;
  label: string;
  allow_guest_chat: boolean;
  allow_guest_media: boolean;
  max_guests: number | null;
  failed_attempts: number;
  locked_until: string | null;
  expires_at: string | null;
  revoked_at: string | null;
};

export async function lookupSessionLinkByToken(
  token: string
): Promise<SessionLinkRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("session_links")
    .select(
      "id, session_room_id, token_hash, passcode_salt, passcode_hash, label, allow_guest_chat, allow_guest_media, max_guests, failed_attempts, locked_until, expires_at, revoked_at"
    )
    .eq("token_hash", sha256Hex(token))
    .maybeSingle();
  if (error || !data) return null;
  return data as SessionLinkRow;
}

export function linkIsJoinable(link: SessionLinkRow, now = new Date()): boolean {
  if (link.revoked_at) return false;
  if (link.expires_at && new Date(link.expires_at).getTime() <= now.getTime()) return false;
  return true;
}

export function guestCookieName(linkId: string): string {
  return `tempo_sg_${linkId}`;
}
