"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";

type CurrentUser = { id: string; email: string | null } | null;

/**
 * The in-flight (or settled) answer to "who is signed in", shared by every
 * caller of the hook.
 *
 * This hook is used from nine places, and several of them mount together on a
 * single screen. Asking `getUser()` from each one meant the same question went
 * to the auth server once per mounted component on every page load. The
 * promise is cached rather than the value so that components mounting in the
 * same tick join the request already in flight instead of starting their own.
 *
 * Cleared on any auth state change below, so a later mount re-reads rather
 * than trusting a stale answer from before a sign-in or sign-out.
 */
let pendingUser: Promise<CurrentUser> | null = null;

function loadCurrentUser(): Promise<CurrentUser> {
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

/** Signed-in user id/email, kept in sync with auth state changes. Null once resolved-and-signed-out, undefined while loading. */
export function useCurrentUser(): CurrentUser | undefined {
  const [user, setUser] = React.useState<CurrentUser | undefined>(undefined);

  React.useEffect(() => {
    const supabase = createClient();
    let active = true;

    void loadCurrentUser().then((resolved) => {
      if (!active) return;
      setUser(resolved);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user
        ? { id: session.user.id, email: session.user.email ?? null }
        : null;
      // Keep the shared cache honest for components that mount later, even if
      // this particular instance has already been unmounted.
      pendingUser = Promise.resolve(next);
      if (!active) return;
      setUser(next);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return user;
}
