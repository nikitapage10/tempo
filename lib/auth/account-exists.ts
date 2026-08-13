/**
 * Server-only: does this email already have a TEMPO auth user?
 * Used by public invite previews so the landing CTA can say "Sign in" vs
 * "Create an account" without letting callers probe arbitrary addresses —
 * the preview route already bound the email to a valid invite token.
 *
 * Returns null when the lookup itself fails, so the UI can fall back to
 * offering both paths rather than guessing.
 */

/**
 * Server-only auth-user lookup by email.
 * `authAccountExistsForEmail` is used by public invite previews so the
 * landing CTA can say "Sign in" vs "Create an account" without letting
 * callers probe arbitrary addresses — those routes already bound the email
 * to a valid invite token. `authUserByEmail` is for authenticated team
 * invites, where the artist already typed the address they want to add.
 */

import { createAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 200;
const MAX_PAGES = 20;

export type AuthUserRef = { id: string; email: string };

/**
 * Resolve an email to an existing auth user. `null` means no account;
 * `undefined` means the lookup itself failed (don't treat as "not found").
 */
export async function authUserByEmail(
  email: string
): Promise<AuthUserRef | null | undefined> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  try {
    const admin = createAdminClient();
    const adminAuth = admin.auth.admin as typeof admin.auth.admin & {
      getUserByEmail?: (value: string) => Promise<{
        data: { user: { id: string; email?: string | null } | null };
        error: { message?: string } | null;
      }>;
    };
    if (typeof adminAuth.getUserByEmail === "function") {
      const { data, error } = await adminAuth.getUserByEmail(normalized);
      if (!error && data?.user?.id) {
        return {
          id: data.user.id,
          email: (data.user.email ?? normalized).toLowerCase(),
        };
      }
      if (!error) return null;
    }

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: PAGE_SIZE,
      });
      if (error) return undefined;
      const match = data.users.find((u) => u.email?.toLowerCase() === normalized);
      if (match) {
        return { id: match.id, email: (match.email ?? normalized).toLowerCase() };
      }
      if (data.users.length < PAGE_SIZE) return null;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function authAccountExistsForEmail(
  email: string
): Promise<boolean | null> {
  const found = await authUserByEmail(email);
  if (found === undefined) return null;
  return found !== null;
}
