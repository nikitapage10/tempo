"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";

type CurrentUser = { id: string; email: string | null } | null;

/** Signed-in user id/email, kept in sync with auth state changes. Null once resolved-and-signed-out, undefined while loading. */
export function useCurrentUser(): CurrentUser | undefined {
  const [user, setUser] = React.useState<CurrentUser | undefined>(undefined);

  React.useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user ? { id: data.user.id, email: data.user.email ?? null } : null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(
        session?.user ? { id: session.user.id, email: session.user.email ?? null } : null
      );
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return user;
}
