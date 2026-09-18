"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  finishAuthNavigation,
  signOutOfTempo,
} from "@/lib/auth/reset-client-session";

function isSafeNext(path: string | null): path is string {
  return !!path && path.startsWith("/") && !path.startsWith("//");
}

/**
 * Exchange the OAuth / magic-link code in the browser (or Electron webview)
 * that started the flow. The PKCE verifier lives in this document's cookies —
 * a server route cannot see it after TEMPO Desktop hands the code back via
 * tempo:// from the system browser.
 *
 * Provider sign-in can *create* a Supabase user, so the exchange alone is not
 * permission to enter TEMPO. /api/auth/oauth-gate confirms the account is an
 * actual member (and refuses + removes an uninvited brand-new one) before the
 * app loads. Anything other than an explicit pass signs back out.
 */
function AuthCallbackInner() {
  const searchParams = useSearchParams();
  const ran = React.useRef(false);

  React.useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = searchParams.get("code");
    const nextParam = searchParams.get("next");
    const next = isSafeNext(nextParam) ? nextParam : "/";
    const authError = searchParams.get("error");

    if (authError || !code) {
      window.location.assign("/login?error=auth");
      return;
    }

    const supabase = createClient();
    void supabase.auth.exchangeCodeForSession(code).then(async ({ error }) => {
      if (error) {
        window.location.assign("/login?error=auth");
        return;
      }

      let allowed = false;
      try {
        const res = await fetch("/api/auth/oauth-gate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          cache: "no-store",
        });
        allowed = res.ok;
      } catch {
        allowed = false;
      }

      if (!allowed) {
        await signOutOfTempo("/login?error=not_invited");
        return;
      }

      await finishAuthNavigation(next);
    });
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-0 px-6">
      <p className="text-sm text-text-lo">Signing you in…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bg-0 px-6">
          <p className="text-sm text-text-lo">Signing you in…</p>
        </div>
      }
    >
      <AuthCallbackInner />
    </React.Suspense>
  );
}
