import { createClient } from "@/lib/supabase/client";

export type CurrentUser = { id: string; email: string | null } | null;

/**
 * The in-flight (or settled) answer to "who is signed in", shared by every
 * caller of useCurrentUser.
 *
 * Cleared on sign-out / account switch so a later mount re-reads rather than
 * trusting a stale answer from the previous account.
 */
let pendingUser: Promise<CurrentUser> | null = null;

export function clearCurrentUserCache() {
  pendingUser = null;
}

export function cacheCurrentUser(user: CurrentUser) {
  pendingUser = Promise.resolve(user);
}

export function loadCurrentUser(): Promise<CurrentUser> {
  if (!pendingUser) {
    pendingUser = createClient()
      .auth.getUser()
      .then(({ data }) =>
        data.user ? { id: data.user.id, email: data.user.email ?? null } : null
      )
      .catch(() => {
        // Don't let one failed lookup become a cached "signed out" for the
        // rest of the session — drop it so the next mount asks again.
        pendingUser = null;
        return null;
      });
  }
  return pendingUser;
}
