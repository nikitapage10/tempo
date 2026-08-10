import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** True if this user/email currently has an active suppression (unsubscribe/bounce/complaint). */
export async function isSuppressed(
  admin: SupabaseClient,
  userId: string,
  email: string
): Promise<boolean> {
  const emailHash = hashEmail(email);
  const { data, error } = await admin
    .from("email_suppressions")
    .select("id")
    .eq("active", true)
    .or(`user_id.eq.${userId},email_hash.eq.${emailHash}`)
    .limit(1);
  if (error) return true; // fail closed — never send if we can't confirm it's safe
  return (data ?? []).length > 0;
}

export async function suppress(
  admin: SupabaseClient,
  input: { userId: string | null; email: string; reason: "unsubscribe" | "hard_bounce" | "complaint" | "operator"; providerEventId?: string }
): Promise<void> {
  await admin.from("email_suppressions").insert({
    user_id: input.userId,
    email_hash: hashEmail(input.email),
    reason: input.reason,
    provider_event_id: input.providerEventId ?? null,
  });
}

/** Ensures a hashed unsubscribe/manage-preferences token exists for this user; returns the raw token only on (re)creation. */
export async function ensurePreferenceToken(
  admin: SupabaseClient,
  userId: string
): Promise<string> {
  const rawToken = randomBytes(24).toString("hex");
  const tokenHash = hashToken(rawToken);
  const { error } = await admin
    .from("email_preference_tokens")
    .upsert({ user_id: userId, token_hash: tokenHash, rotated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
  return rawToken;
}

export async function resolvePreferenceToken(
  admin: SupabaseClient,
  rawToken: string
): Promise<string | null> {
  if (!rawToken || rawToken.length < 16 || rawToken.length > 128) return null;
  const tokenHash = hashToken(rawToken);
  const { data, error } = await admin
    .from("email_preference_tokens")
    .select("user_id")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error || !data) return null;
  return data.user_id;
}
