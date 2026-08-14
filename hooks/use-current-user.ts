"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import {
  cacheCurrentUser,
  loadCurrentUser,
  type CurrentUser,
} from "@/lib/auth/current-user-cache";

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
      cacheCurrentUser(next);
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
