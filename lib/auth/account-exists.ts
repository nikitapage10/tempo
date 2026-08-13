/**
 * Server-only: does this email already have a TEMPO auth user?
 * Used by public invite previews so the landing CTA can say "Sign in" vs
 * "Create an account" without letting callers probe arbitrary addresses —
 * the preview route already bound the email to a valid invite token.
 *
 * Returns null when the lookup itself fails, so the UI can fall back to
 * offering both paths rather than guessing.
 */

import { createAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 200;
const MAX_PAGES = 20;

export async function authAccountExistsForEmail(
  email: string
): Promise<boolean | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  try {
    const admin = createAdminClient();
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: PAGE_SIZE,
      });
      if (error) return null;
      if (data.users.some((u) => u.email?.toLowerCase() === normalized)) {
        return true;
      }
      if (data.users.length < PAGE_SIZE) return false;
    }
    return null;
  } catch {
    return null;
  }
}
