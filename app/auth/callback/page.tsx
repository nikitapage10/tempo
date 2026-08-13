"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function isSafeNext(path: string | null): path is string {
  return !!path && path.startsWith("/") && !path.startsWith("//");
}

/**
 * Exchange the OAuth / magic-link code in the browser (or Electron webview)
 * that started the flow. The PKCE verifier lives in this document's cookies —
 * a server route cannot see it after TEMPO Desktop hands the code back via
 * tempo:// from the system browser.
 */
function AuthCallbackInner() {
  const router = useRouter();
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
      router.replace("/login?error=auth");
      return;
    }

    const supabase = createClient();
    void supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      router.replace(error ? "/login?error=auth" : next);
    });
  }, [router, searchParams]);

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
