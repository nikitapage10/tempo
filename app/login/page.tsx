"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { IntroMoment } from "@/components/intro-moment";
import { FlareLine } from "@/components/flare-line";
import { LfWindow } from "@/components/lf-windows";

function isSafeRedirect(path: string | null): path is string {
  return !!path && path.startsWith("/") && !path.startsWith("//");
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setStatus("error");
      const raw = signInError.message;
      const lower = raw.toLowerCase();
      if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
        setError(
          "Wrong email or password. Create an account from Sign in → Create one, or set a password in Supabase → Authentication → Users."
        );
      } else if (lower.includes("email not confirmed")) {
        setError(
          "Email confirmation is still on in Supabase. Turn off “Confirm email” under Authentication → Providers → Email, or confirm the user in the dashboard."
        );
      } else {
        setError(`${raw} — try again.`);
      }
      return;
    }

    router.replace(isSafeRedirect(redirectTo) ? redirectTo : "/");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen flex-col" data-lf-chrome>
      <IntroMoment />
      <LfWindow className="edge-strip lf-window" aria-hidden />

      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-10 text-center">
            <h1 className="font-display text-[28px] font-bold tracking-tight text-text-hi">
              TEMPO
            </h1>
            <FlareLine className="mx-auto mt-3 max-w-[120px]" />
            <p className="mt-4 text-text-lo">
              Sign in with email and password.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-card border border-line bg-bg-1 p-6 shadow-raise"
          >
            <label
              htmlFor="email"
              className="mb-2 block font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@studio.com"
              className="h-10 w-full rounded-input border border-line bg-bg-2 px-3 text-text-hi placeholder:text-text-lo/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            />

            <label
              htmlFor="password"
              className="mb-2 mt-4 block font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-10 w-full rounded-input border border-line bg-bg-2 px-3 text-text-hi placeholder:text-text-lo/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            />

            {error && (
              <p className="mt-3 text-sm text-warn" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="mt-5 w-full"
              disabled={
                status === "loading" || !email.trim() || password.length < 1
              }
            >
              {status === "loading" ? "Signing in…" : "Sign in"}
            </Button>

            <p className="mt-4 text-center text-xs text-text-lo">
              No account yet?{" "}
              <Link
                href={
                  isSafeRedirect(redirectTo)
                    ? `/register?redirect=${encodeURIComponent(redirectTo)}`
                    : "/register"
                }
                className="text-ice hover:underline"
              >
                Create one
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
